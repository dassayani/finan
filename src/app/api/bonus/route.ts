import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];
function toBankKey(s: string | null | undefined): BankKey | null {
  return s && BANK_KEYS.includes(s as BankKey) ? (s as BankKey) : null;
}

// Encode: type + payMonth into a unique month key stored in Salary.month
// PLR base = 1400  → PLR June = 1406, PLR December = 1412
// Décimo base = 1300 → Décimo June = 1306, Décimo December = 1312
const PLR_BASE    = 1400;
const DECIMO_BASE = 1300;
const FERIAS_BASE = 1200;

function encodeMonth(type: "plr" | "decimo" | "ferias", payMonth: number): number {
  if (type === "plr")    return PLR_BASE    + payMonth;
  if (type === "decimo") return DECIMO_BASE + payMonth;
  return FERIAS_BASE + payMonth;
}

const itemSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  type: z.enum(["PROVENTO", "DESCONTO"]),
  order: z.number().optional(),
});

const bonusSchema = z.object({
  type: z.enum(["plr", "decimo", "ferias"]),
  year: z.number().int().min(2000),
  payDate: z.string(),
  baseAmount: z.number(),
  netAmount: z.number(),
  notes: z.string().optional().nullable(),
  bank: z.string().nullable().optional(),
  customBankId: z.string().nullable().optional(),
  items: z.array(itemSchema),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = Number(searchParams.get("year")  ?? new Date().getFullYear());
  const month = searchParams.get("month") ? Number(searchParams.get("month")) : null;

  // Fetch all PLR, Décimo e Férias entries for the year
  const [allPlr, allDecimo, allFerias] = await Promise.all([
    prisma.salary.findMany({
      where: { userId: session.user.id, year, month: { gte: PLR_BASE + 1, lte: PLR_BASE + 12 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.salary.findMany({
      where: { userId: session.user.id, year, month: { gte: DECIMO_BASE + 1, lte: DECIMO_BASE + 12 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.salary.findMany({
      where: { userId: session.user.id, year, month: { gte: FERIAS_BASE + 1, lte: FERIAS_BASE + 12 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
  ]);

  // Filter to the requested month (payMonth = month % 100 in new format, or payDay in old format)
  const filterByMonth = <T extends { month: number; payDay: number | null }>(entries: T[]): T | null => {
    if (!month) return entries[0] ?? null;
    return entries.find(e => (e.month % 100) === month) ?? null;
  };

  return NextResponse.json({ plr: filterByMonth(allPlr), decimo: filterByMonth(allDecimo), ferias: filterByMonth(allFerias) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { type, items, payDate, bank: bankField, customBankId: customBankIdField, ...data } = bonusSchema.parse(body);

    const bankKey      = toBankKey(bankField);
    const customBankId = customBankIdField ?? null;

    // Ownership do banco customizado — impede referenciar banco de outro usuário
    if (customBankId) {
      const cb = await prisma.customBank.findUnique({ where: { id: customBankId }, select: { userId: true } });
      if (!cb || cb.userId !== session.user.id) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }
    }

    const payMonth     = new Date(payDate).getUTCMonth() + 1;
    const salaryMonth  = encodeMonth(type, payMonth);
    const label        = type === "plr" ? "PLR" : type === "decimo" ? "Décimo Terceiro" : "Férias";
    const groupId      = `bonus-${type}-${data.year}-${payMonth}-${session.user.id}`;
    const entryGroupId = `bonus-entry-${type}-${data.year}-${payMonth}-${session.user.id}`;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.salary.upsert({
        where: { userId_month_year: { userId: session.user.id, month: salaryMonth, year: data.year } },
        create: {
          month: salaryMonth, year: data.year, userId: session.user.id,
          baseAmount: data.baseAmount, netAmount: data.netAmount,
          payDay: payMonth, notes: data.notes ?? null,
          salaryBank: bankKey, salaryCustomBankId: customBankId,
          items: { create: items.map((it, i) => ({ ...it, order: it.order ?? i })) },
        },
        update: {
          baseAmount: data.baseAmount, netAmount: data.netAmount,
          payDay: payMonth, notes: data.notes ?? null,
          salaryBank: bankKey, salaryCustomBankId: customBankId,
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
            data: { amount: data.netAmount, date: txDate, notes: data.notes ?? null, bank: bankKey },
          });
        } else {
          await tx.transaction.create({
            data: {
              description: label, amount: data.netAmount,
              type: "INCOME", category: "trab",
              bank: bankKey, date: txDate, notes: data.notes ?? null,
              isPaid: false, groupId, userId: session.user.id,
            },
          });
        }

        // Upsert BankEntry for this bonus
        if (bankKey || customBankId) {
          const existingEntry = await tx.bankEntry.findFirst({
            where: { userId: session.user.id, groupId: entryGroupId },
          });
          const preservedIsPaid = existingEntry?.isPaid ?? false;
          await tx.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });
          await tx.bankEntry.create({
            data: {
              userId: session.user.id, bank: bankKey, customBankId,
              month: payMonth, year: data.year,
              description: label, amount: data.netAmount,
              type: "INCOME", category: "trab",
              groupId: entryGroupId, isPaid: preservedIsPaid,
            },
          });
        } else {
          // Bank removed — delete BankEntry if it exists
          await tx.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });
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
  const type     = searchParams.get("type") as "plr" | "decimo" | "ferias" | null;
  const year     = Number(searchParams.get("year"));
  const payMonth = Number(searchParams.get("payMonth"));

  if (!type || !year || !payMonth) {
    return NextResponse.json({ error: "type, year e payMonth são obrigatórios" }, { status: 400 });
  }

  const salaryMonth  = encodeMonth(type, payMonth);
  const groupId      = `bonus-${type}-${year}-${payMonth}-${session.user.id}`;
  const entryGroupId = `bonus-entry-${type}-${year}-${payMonth}-${session.user.id}`;

  await prisma.salary.deleteMany({ where: { userId: session.user.id, month: salaryMonth, year } });
  await prisma.transaction.deleteMany({ where: { userId: session.user.id, groupId } });
  await prisma.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });

  return new NextResponse(null, { status: 204 });
}
