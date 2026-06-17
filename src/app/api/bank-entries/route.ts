import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS, CATEGORIES } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";

const bankKeySchema = z.string().refine((value): value is BankKey => value in BANKS, {
  message: "Banco inválido",
});

const categoryKeySchema = z.string().refine((value): value is CategoryKey => value in CATEGORIES, {
  message: "Categoria inválida",
});

const schema = z.object({
  bank: bankKeySchema.optional().nullable(),
  customBankId: z.string().optional().nullable(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  description: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  groupId: z.string().optional().nullable(),
  installments: z.number().int().positive().optional().nullable(),
  category: categoryKeySchema.optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.bank && !data.customBankId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bank"],
      message: "Informe bank ou customBankId",
    });
  }
  if (data.bank && data.customBankId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customBankId"],
      message: "Informe apenas bank ou customBankId",
    });
  }
});

type BatchFailure = {
  index: number;
  error: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(issue => issue.message).join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro interno";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const year  = searchParams.get("year");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (month) where.month = Number(month);
  if (year)  where.year  = Number(year);

  const entries = await prisma.bankEntry.findMany({ where, orderBy: { createdAt: "asc" } });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    if (Array.isArray(body) || (body && typeof body === "object" && Array.isArray(body.items))) {
      const rawItems = Array.isArray(body) ? body : body.items;
      const failures: BatchFailure[] = [];
      const created: Array<{ index: number; id: string }> = [];

      await Promise.all(rawItems.map(async (rawItem: unknown, index: number) => {
        try {
          const data = schema.parse(rawItem);

          if (data.customBankId) {
            const customBank = await prisma.customBank.findUnique({
              where: { id: data.customBankId },
              select: { userId: true },
            });

            if (!customBank || customBank.userId !== session.user.id) {
              failures.push({ index, error: "Não autorizado" });
              return;
            }
          }

          const entry = await prisma.bankEntry.create({
            data: {
              bank: data.bank ?? null,
              customBankId: data.customBankId ?? null,
              month: data.month,
              year: data.year,
              description: data.description,
              amount: data.amount,
              type: data.type,
              groupId: data.groupId ?? null,
              installments: data.installments ?? null,
              category: data.category ?? null,
              userId: session.user.id,
            },
          });

          created.push({ index, id: entry.id });
        } catch (error) {
          failures.push({ index, error: getErrorMessage(error) });
        }
      }));

      const total = rawItems.length;
      const successCount = created.length;
      const failedCount = failures.length;
      const status = failedCount > 0 ? 207 : 201;

      return NextResponse.json({
        mode: "batch",
        total,
        successCount,
        failedCount,
        created,
        failures,
      }, { status });
    }

    const data = schema.parse(body);

    if (data.customBankId) {
      const customBank = await prisma.customBank.findUnique({
        where: { id: data.customBankId },
        select: { userId: true },
      });

      if (!customBank || customBank.userId !== session.user.id) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }
    }

    const entry = await prisma.bankEntry.create({
      data: {
        bank: data.bank ?? null,
        customBankId: data.customBankId ?? null,
        month: data.month,
        year: data.year,
        description: data.description,
        amount: data.amount,
        type: data.type,
        groupId: data.groupId ?? null,
        installments: data.installments ?? null,
        category: data.category ?? null,
        userId: session.user.id,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("[bank-entries POST]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const groupId          = searchParams.get("groupId");
  const descriptionBase  = searchParams.get("descriptionBase");
  const bank             = searchParams.get("bank");
  const customBankId     = searchParams.get("customBankId");
  const month            = searchParams.get("month");
  const year             = searchParams.get("year");
  const uid              = session.user.id;

  if (groupId) {
    // month+year opcionais: deleta só aquele mês do grupo (ex.: "excluir só este
    // mês" de uma recorrência); sem eles, deleta o grupo inteiro.
    const where: Record<string, unknown> = { groupId, userId: uid };
    if (month && year) { where.month = Number(month); where.year = Number(year); }
    await prisma.bankEntry.deleteMany({ where });
  } else if (descriptionBase) {
    // Fallback para entradas sem groupId:
    // - parcelas: "nome 2/5" → startsWith("nome ")
    // - mensais:  "nome"     → equals("nome")
    const where: Record<string, unknown> = {
      userId: uid,
      OR: [
        { description: { startsWith: descriptionBase + " " } },
        { description: descriptionBase },
      ],
    };
    if (bank)         where.bank         = bank;
    if (customBankId) where.customBankId = customBankId;
    await prisma.bankEntry.deleteMany({ where });
  } else {
    return NextResponse.json({ error: "groupId ou descriptionBase é obrigatório" }, { status: 400 });
  }

  return new NextResponse(null, { status: 204 });
}
