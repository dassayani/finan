import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS } from "@/lib/constants";
import type { BankKey } from "@/lib/constants";

const BANK_KEYS = Object.keys(BANKS) as BankKey[];

function toBankKey(s: string | null | undefined): BankKey | null {
  return s && BANK_KEYS.includes(s as BankKey) ? (s as BankKey) : null;
}

// Returns true if (month, year) >= (sinceMonth, sinceYear)
function isOnOrAfterSince(month: number, year: number, sinceMonth: number | null, sinceYear: number | null): boolean {
  if (!sinceMonth || !sinceYear) return true; // no restriction
  return year > sinceYear || (year === sinceYear && month >= sinceMonth);
}

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
  salaryBank: z.string().nullable().optional(),
  salaryCustomBankId: z.string().nullable().optional(),
  salaryBankSinceMonth: z.number().int().min(1).max(12).nullable().optional(),
  salaryBankSinceYear: z.number().int().min(2000).nullable().optional(),
  items: z.array(itemSchema),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const month = Number(searchParams.get("month") ?? 0);
    const year = Number(searchParams.get("year") ?? 0);

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

    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const [prevSalary, bankEntry] = await Promise.all([
      month > 0
        ? prisma.salary.findUnique({
            where: { userId_month_year: { userId: session.user.id, month: prevMonth, year: prevYear } },
            include: { items: { orderBy: { order: "asc" } } },
          })
        : null,
      month > 0
        ? prisma.bankEntry.findFirst({
            where: {
              userId: session.user.id, month, year,
              groupId: `salary-entry-${session.user.id}-${month}-${year}`,
            },
            select: { id: true, bank: true, customBankId: true, isPaid: true },
          })
        : null,
    ]);

    return NextResponse.json({
      template,
      monthSalary,
      effective: monthSalary ?? prevSalary ?? template,
      source: monthSalary ? "month" : prevSalary ? "prev" : template ? "template" : null,
      bankEntry,
    });
  } catch (error) {
    console.error("[salary GET]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = salarySchema.parse(body);
    const {
      items,
      salaryBank,
      salaryCustomBankId,
      salaryBankSinceMonth,
      salaryBankSinceYear,
      month: reqMonth,
      year: reqYear,
      ...fields
    } = parsed;

    const bankKey = toBankKey(salaryBank);
    const customBankId = salaryCustomBankId ?? null;
    const sinceMonth = salaryBankSinceMonth ?? null;
    const sinceYear = salaryBankSinceYear ?? null;

    const itemRows = items.map((it, i) => ({ ...it, order: it.order ?? i }));

    const result = await prisma.$transaction(async tx => {
      if (reqMonth === 0) {
        // ── Template save — use explicit create/update (avoids upsert subtleties) ──
        const existing = await tx.salary.findUnique({
          where: { userId_month_year: { userId: session.user.id, month: 0, year: 0 } },
        });

        let saved;
        if (existing) {
          await tx.salary.update({
            where: { id: existing.id },
            data: {
              ...fields,
              salaryBank: bankKey,
              salaryCustomBankId: customBankId,
              salaryBankSinceMonth: sinceMonth,
              salaryBankSinceYear: sinceYear,
              items: { deleteMany: {}, create: itemRows },
            },
          });
          saved = await tx.salary.findUnique({
            where: { id: existing.id },
            include: { items: { orderBy: { order: "asc" } } },
          });
        } else {
          saved = await tx.salary.create({
            data: {
              month: 0, year: 0, userId: session.user.id,
              ...fields,
              salaryBank: bankKey,
              salaryCustomBankId: customBankId,
              salaryBankSinceMonth: sinceMonth,
              salaryBankSinceYear: sinceYear,
              items: { create: itemRows },
            },
            include: { items: { orderBy: { order: "asc" } } },
          });
        }

        // Backfill: create BankEntries for month salaries >= since date that don't have one yet
        if (bankKey || customBankId) {
          const monthSalaries = await tx.salary.findMany({
            where: { userId: session.user.id, month: { gt: 0 } },
          });

          for (const ms of monthSalaries) {
            if (!isOnOrAfterSince(ms.month, ms.year, sinceMonth, sinceYear)) continue;

            const entryGroupId = `salary-entry-${session.user.id}-${ms.month}-${ms.year}`;
            const exists = await tx.bankEntry.findFirst({
              where: { userId: session.user.id, groupId: entryGroupId },
            });
            if (exists) continue;

            const txn = await tx.transaction.findFirst({
              where: {
                userId: session.user.id, type: "INCOME",
                groupId: `salary-${session.user.id}`,
                date: {
                  gte: new Date(Date.UTC(ms.year, ms.month - 1, 1)),
                  lte: new Date(Date.UTC(ms.year, ms.month, 0, 23, 59, 59, 999)),
                },
              },
              select: { isPaid: true },
            });

            await tx.bankEntry.create({
              data: {
                userId: session.user.id, bank: bankKey, customBankId,
                month: ms.month, year: ms.year,
                description: "Salário", amount: ms.netAmount,
                type: "INCOME", category: "salario",
                groupId: entryGroupId, isPaid: txn?.isPaid ?? false,
              },
            });
          }
        } else {
          // Bank removed from template — delete all salary BankEntries inherited from it
          await tx.bankEntry.deleteMany({
            where: {
              userId: session.user.id,
              groupId: { startsWith: `salary-entry-${session.user.id}-` },
            },
          });
        }

        return saved;
      }

      // ── Month salary save ────────────────────────────────────────────────────
      const existing = await tx.salary.findUnique({
        where: { userId_month_year: { userId: session.user.id, month: reqMonth, year: reqYear } },
      });

      let saved;
      if (existing) {
        await tx.salary.update({
          where: { id: existing.id },
          data: { ...fields, items: { deleteMany: {}, create: itemRows } },
        });
        saved = await tx.salary.findUnique({
          where: { id: existing.id },
          include: { items: { orderBy: { order: "asc" } } },
        });
      } else {
        saved = await tx.salary.create({
          data: {
            month: reqMonth, year: reqYear, userId: session.user.id,
            ...fields,
            items: { create: itemRows },
          },
          include: { items: { orderBy: { order: "asc" } } },
        });
      }

      if (fields.netAmount > 0) {
        const payDay = fields.payDay ?? 5;
        const txDate = new Date(Date.UTC(reqYear, reqMonth - 1, payDay));
        const salaryGroupId = `salary-${session.user.id}`;

        // Fetch existing BankEntry early — needed to distinguish "user cleared bank" from "never had bank"
        const entryGroupId = `salary-entry-${session.user.id}-${reqMonth}-${reqYear}`;
        const existingEntry = await tx.bankEntry.findFirst({ where: { userId: session.user.id, groupId: entryGroupId } });

        // Resolve bank: use request bank if provided.
        // Fall back to template ONLY when there is no existing BankEntry (brand-new month salary
        // inheriting template bank). If an entry already existed and bankKey is null, the user
        // explicitly removed the bank — respect that, do not re-apply the template.
        let resolvedBankKey: BankKey | null = bankKey;
        let resolvedCustomBankId: string | null = customBankId;
        if (!resolvedBankKey && !resolvedCustomBankId && !existingEntry) {
          const template = await tx.salary.findUnique({
            where: { userId_month_year: { userId: session.user.id, month: 0, year: 0 } },
            select: { salaryBank: true, salaryCustomBankId: true, salaryBankSinceMonth: true, salaryBankSinceYear: true },
          });
          if (template && isOnOrAfterSince(reqMonth, reqYear, template.salaryBankSinceMonth, template.salaryBankSinceYear)) {
            resolvedBankKey = template.salaryBank ?? null;
            resolvedCustomBankId = template.salaryCustomBankId ?? null;
          }
        }

        // Upsert salary Transaction
        const existingTx = await tx.transaction.findFirst({
          where: {
            userId: session.user.id, type: "INCOME", groupId: salaryGroupId,
            date: {
              gte: new Date(Date.UTC(reqYear, reqMonth - 1, 1)),
              lte: new Date(Date.UTC(reqYear, reqMonth, 0, 23, 59, 59, 999)),
            },
          },
        });

        if (existingTx) {
          await tx.transaction.update({
            where: { id: existingTx.id },
            data: { amount: fields.netAmount, date: txDate, notes: fields.notes ?? null, bank: resolvedBankKey, category: "salario" },
          });
        } else {
          await tx.transaction.create({
            data: {
              description: "Salário", amount: fields.netAmount, type: "INCOME",
              category: "salario", bank: resolvedBankKey, date: txDate,
              notes: fields.notes ?? null, isPaid: false, groupId: salaryGroupId,
              userId: session.user.id,
            },
          });
        }

        // Upsert BankEntry — recreate to pick up bank changes
        const preservedIsPaid = existingEntry?.isPaid ?? false;
        await tx.bankEntry.deleteMany({ where: { userId: session.user.id, groupId: entryGroupId } });

        if (resolvedBankKey || resolvedCustomBankId) {
          await tx.bankEntry.create({
            data: {
              userId: session.user.id, bank: resolvedBankKey, customBankId: resolvedCustomBankId,
              month: reqMonth, year: reqYear, description: "Salário", amount: fields.netAmount,
              type: "INCOME", category: "salario", groupId: entryGroupId, isPaid: preservedIsPaid,
            },
          });
        }
      }

      return saved;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[salary POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
