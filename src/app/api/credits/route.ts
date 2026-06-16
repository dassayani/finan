import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS, CATEGORIES } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });
const categoryKeySchema = z.string().refine((v): v is CategoryKey => v in CATEGORIES, { message: "Categoria inválida" });

const createSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categoryKeySchema.nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Data inválida"),
  notes: z.string().nullable().optional(),
  isPaid: z.boolean().optional(),
  bank: bankKeySchema.nullable().optional(),
  customBankId: z.string().nullable().optional(),
  recurring: z.object({ until: z.string().nullable().optional() }).nullable().optional(),
}).refine(d => !(d.bank && d.customBankId), { message: "Informe apenas bank ou customBankId", path: ["customBankId"] });

/** Deriva {month, year} de uma string YYYY-MM-DD sem day-shift de fuso. */
function ymOf(dateStr: string): { month: number; year: number } {
  const [y, m] = dateStr.split("-").map(Number);
  return { month: m, year: y };
}

/** Lista de datas mensais de start até until (inclusive), em strings YYYY-MM-DD. */
function monthlyDates(startStr: string, untilStr: string | null | undefined): string[] {
  const [y, m, d] = startStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = untilStr
    ? (() => { const [uy, um, ud] = untilStr.split("-").map(Number); return new Date(Date.UTC(uy, um - 1, ud)); })()
    : new Date(Date.UTC(y, m - 1 + 23, d));
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out.length > 0 ? out : [startStr];
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year = searchParams.get("year");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId: session.user.id, type: "INCOME" };

  if (month && year) {
    const y = Number(year), m = Number(month);
    where.date = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
    };
  }

  const credits = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json(credits);
}

/**
 * Cria uma receita (e, se um banco for informado, o lançamento bancário espelho)
 * de forma ATÔMICA. Substitui o antigo fluxo de dois fetch separados no cliente,
 * que deixava órfãos quando a segunda chamada falhava.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  try {
    const data = createSchema.parse(await req.json());
    const bank = data.bank ?? null;
    const customBankId = data.customBankId ?? null;
    const hasBank = !!(bank || customBankId);

    // Ownership do banco customizado
    if (customBankId) {
      const cb = await prisma.customBank.findUnique({ where: { id: customBankId }, select: { userId: true } });
      if (!cb || cb.userId !== uid) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const dates = data.recurring ? monthlyDates(data.date, data.recurring.until) : [data.date];
    const groupId = data.recurring ? `recur-${Date.now()}` : null;

    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ids: string[] = [];
      for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        const transaction = await tx.transaction.create({
          data: {
            description: data.description,
            amount: data.amount,
            type: "INCOME",
            category: (data.category as CategoryKey) ?? null,
            bank,
            date: new Date(dateStr),
            notes: data.notes ?? null,
            // Em recorrência, só a primeira ocorrência nasce paga (comportamento anterior)
            isPaid: data.recurring ? i === 0 : (data.isPaid ?? false),
            groupId,
            userId: uid,
          },
        });
        ids.push(transaction.id);

        if (hasBank) {
          const { month, year } = ymOf(dateStr);
          await tx.bankEntry.create({
            data: {
              userId: uid, bank, customBankId,
              month, year,
              description: data.description, amount: data.amount,
              type: "INCOME", category: (data.category as CategoryKey) ?? null,
              groupId: `credit-entry-${transaction.id}`,
              isPaid: data.recurring ? i === 0 : (data.isPaid ?? false),
            },
          });
        }
      }
      return ids;
    });

    return NextResponse.json({ ids: created, count: created.length }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    console.error("[credits POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
