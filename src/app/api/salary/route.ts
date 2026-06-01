import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  type: z.enum(["PROVENTO", "DESCONTO"]),
  order: z.number().optional(),
});

const salarySchema = z.object({
  month: z.number().int().min(0).max(12),
  year: z.number().int().min(0),
  baseAmount: z.number(),
  netAmount: z.number(),
  payDay: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema),
});

// GET /api/salary?month=X&year=Y
// Returns: the salary for that month, or falls back to previous month, then template (0,0)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = Number(searchParams.get("month") ?? 0);
  const year = Number(searchParams.get("year") ?? 0);

  // Fetch template (0,0) and the specific month
  const [template, monthSalary] = await Promise.all([
    prisma.salary.findUnique({
      where: { userId_month_year: { userId: session.user.id, month: 0, year: 0 } },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    month > 0
      ? prisma.salary.findUnique({
          where: { userId_month_year: { userId: session.user.id, month, year } },
          include: { items: { orderBy: { order: "asc" } } },
        })
      : null,
  ]);

  // Also fetch previous month for fallback info
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevSalary = month > 0
    ? await prisma.salary.findUnique({
        where: { userId_month_year: { userId: session.user.id, month: prevMonth, year: prevYear } },
        include: { items: { orderBy: { order: "asc" } } },
      })
    : null;

  return NextResponse.json({
    template,
    monthSalary,
    // effective: what to display for this month
    effective: monthSalary ?? prevSalary ?? template,
    source: monthSalary ? "month" : prevSalary ? "prev" : template ? "template" : null,
  });
}

// POST /api/salary — create or upsert salary for a month/template
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { items, ...data } = salarySchema.parse(body);

    const salary = await prisma.salary.upsert({
      where: { userId_month_year: { userId: session.user.id, month: data.month, year: data.year } },
      create: {
        ...data,
        userId: session.user.id,
        items: { create: items.map((it, i) => ({ ...it, order: it.order ?? i })) },
      },
      update: {
        ...data,
        items: {
          deleteMany: {},
          create: items.map((it, i) => ({ ...it, order: it.order ?? i })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error) {
    console.error("[salary POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
