import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Encode: type + payMonth into a unique month key stored in Salary.month
// PLR base = 1400  → PLR June = 1406, PLR December = 1412
// Décimo base = 1300 → Décimo June = 1306, Décimo December = 1312
const PLR_BASE    = 1400;
const DECIMO_BASE = 1300;

function encodeMonth(type: "plr" | "decimo", payMonth: number): number {
  return (type === "plr" ? PLR_BASE : DECIMO_BASE) + payMonth;
}

const itemSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  type: z.enum(["PROVENTO", "DESCONTO"]),
  order: z.number().optional(),
});

const bonusSchema = z.object({
  type: z.enum(["plr", "decimo"]),
  year: z.number().int().min(2000),
  payDate: z.string(),
  baseAmount: z.number(),
  netAmount: z.number(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")  ?? new Date().getFullYear());
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : null;

  // Fetch all PLR and Décimo entries for the year
  const [allPlr, allDecimo] = await Promise.all([
    prisma.salary.findMany({
      where: { userId: session.user.id, year, month: { gte: PLR_BASE + 1, lte: PLR_BASE + 12 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.salary.findMany({
      where: { userId: session.user.id, year, month: { gte: DECIMO_BASE + 1, lte: DECIMO_BASE + 12 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
  ]);

  // Filter to the requested month (payMonth = month % 100 in new format, or payDay in old format)
  const filterByMonth = <T extends { month: number; payDay: number | null }>(entries: T[]): T | null => {
    if (!month) return entries[0] ?? null;
    return entries.find(e => (e.month % 100) === month) ?? null;
  };

  return NextResponse.json({ plr: filterByMonth(allPlr), decimo: filterByMonth(allDecimo) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { type, items, payDate, ...data } = bonusSchema.parse(body);

    const payMonth = new Date(payDate).getUTCMonth() + 1;
    const salaryMonth = encodeMonth(type, payMonth);
    const label   = type === "plr" ? "PLR" : "Décimo Terceiro";
    const groupId = `bonus-${type}-${data.year}-${payMonth}-${session.user.id}`;

    await prisma.$transaction(async (tx) => {
      await tx.salary.upsert({
        where: { userId_month_year: { userId: session.user.id, month: salaryMonth, year: data.year } },
        create: {
          month: salaryMonth, year: data.year, userId: session.user.id,
          baseAmount: data.baseAmount, netAmount: data.netAmount,
          payDay: payMonth, notes: data.notes ?? null,
          items: { create: items.map((it, i) => ({ ...it, order: it.order ?? i })) },
        },
        update: {
          baseAmount: data.baseAmount, netAmount: data.netAmount,
          payDay: payMonth, notes: data.notes ?? null,
          items: { deleteMany: {}, create: items.map((it, i) => ({ ...it, order: it.order ?? i })) },
        },
        include: { items: { orderBy: { order: "asc" } } },
      });

      if (data.netAmount > 0) {
        const txDate   = new Date(payDate);
        const existing = await tx.transaction.findFirst({
          where: { userId: session.user.id, type: "INCOME", groupId },
        });

        if (existing) {
          await tx.transaction.update({
            where: { id: existing.id },
            data: { amount: data.netAmount, date: txDate, notes: data.notes ?? null },
          });
        } else {
          await tx.transaction.create({
            data: {
              description: label, amount: data.netAmount,
              type: "INCOME", category: "trab",
              date: txDate, notes: data.notes ?? null,
              isPaid: false, groupId, userId: session.user.id,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[bonus POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get("type") as "plr" | "decimo" | null;
  const year     = Number(searchParams.get("year"));
  const payMonth = Number(searchParams.get("payMonth"));

  if (!type || !year || !payMonth) {
    return NextResponse.json({ error: "type, year e payMonth são obrigatórios" }, { status: 400 });
  }

  const salaryMonth = encodeMonth(type, payMonth);
  const groupId     = `bonus-${type}-${year}-${payMonth}-${session.user.id}`;

  await prisma.salary.deleteMany({
    where: { userId: session.user.id, month: salaryMonth, year },
  });
  await prisma.transaction.deleteMany({
    where: { userId: session.user.id, groupId },
  });

  return new NextResponse(null, { status: 204 });
}
