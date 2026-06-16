import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS, CATEGORIES } from "@/lib/constants";
import type { CategoryKey, BankKey } from "@/lib/constants";
import { recordAudit, ipFromRequest } from "@/lib/audit";

const bankKeySchema = z.string().refine((value): value is BankKey => value in BANKS, {
  message: "Banco inválido",
});

const categoryKeySchema = z.string().refine((value): value is CategoryKey => value in CATEGORIES, {
  message: "Categoria inválida",
});

const updateSchema = z.object({
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  expenseType: z.enum(["FIXED", "VARIABLE", "BANK_BILL"]).optional().nullable(),
  category: categoryKeySchema.optional().nullable(),
  bank: bankKeySchema.optional().nullable(),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  isPaid: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const uid = session.user.id;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const before = await prisma.transaction.findFirst({
      where: { id, userId: uid },
      select: { description: true, amount: true, type: true, category: true, bank: true, expenseType: true, isPaid: true, date: true },
    });
    if (!before) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const transaction = await prisma.transaction.update({
      where: { id, userId: uid },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        ...(data.category !== undefined ? { category: (data.category as CategoryKey) ?? null } : {}),
        ...(data.bank !== undefined ? { bank: (data.bank as BankKey) ?? null } : {}),
      },
    });

    await recordAudit({
      userId: uid, action: "UPDATE", entity: "transaction", entityId: id,
      before: { ...before, amount: Number(before.amount) },
      after: { ...data },
      ip: ipFromRequest(req),
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("[transactions PUT]", error);
    if (error instanceof z.ZodError) {
      const msg = error.issues.map(issue => issue.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const uid = session.user.id;
  const before = await prisma.transaction.findFirst({
    where: { id, userId: uid },
    select: { description: true, amount: true, type: true, category: true, bank: true, expenseType: true, isPaid: true, groupId: true },
  });
  const result = await prisma.transaction.deleteMany({ where: { id, userId: uid } });
  if (result.count === 0) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await recordAudit({
    userId: uid, action: "DELETE", entity: "transaction", entityId: id,
    before: before ? { ...before, amount: Number(before.amount) } : null,
    ip: ipFromRequest(req),
  });

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.isPaid !== "boolean") {
    return NextResponse.json({ error: "isPaid (boolean) é obrigatório" }, { status: 400 });
  }
  const { isPaid } = body;
  const uid = session.user.id;

  try {
    // Toda a cascata roda numa única transação de banco: ou tudo é atualizado, ou
    // nada — evita dessincronização entre Transaction, BankEntry e *Payment quando
    // uma das etapas falha no meio do caminho.
    const transaction = await prisma.$transaction(async tx => {
      // Ownership-safe: updateMany com userId garante que só o dono altera.
      const updated = await tx.transaction.updateMany({
        where: { id, userId: uid },
        data: { isPaid },
      });
      if (updated.count === 0) return null;

      const transaction = await tx.transaction.findFirst({ where: { id, userId: uid } });
      if (!transaction) return null;

      // Sync linked BankEntry when Transaction isPaid changes
      if (transaction.groupId === `salary-${uid}`) {
        const month = transaction.date.getUTCMonth() + 1;
        const year = transaction.date.getUTCFullYear();
        await tx.bankEntry.updateMany({
          where: { userId: uid, groupId: `salary-entry-${uid}-${month}-${year}` },
          data: { isPaid },
        });
      } else if (transaction.groupId?.startsWith("bonus-")) {
        const entryGroupId = transaction.groupId.replace("bonus-", "bonus-entry-");
        await tx.bankEntry.updateMany({
          where: { userId: uid, groupId: entryGroupId },
          data: { isPaid },
        });
      }
      // Always try to sync a credit-entry BankEntry linked by transaction id
      await tx.bankEntry.updateMany({
        where: { userId: uid, groupId: `credit-entry-${id}` },
        data: { isPaid },
      });

      // Sync SubscriptionPayment (owner) when a sub-bill-* transaction isPaid changes
      if (transaction.groupId?.startsWith("sub-bill-")) {
        // groupId format: sub-bill-{subId}-{month}-{year}
        const parts = transaction.groupId.split("-");
        const subYear  = parseInt(parts[parts.length - 1]);
        const subMonth = parseInt(parts[parts.length - 2]);
        const subId    = parts.slice(2, parts.length - 2).join("-");
        const owner = await tx.subscriptionMember.findFirst({
          where: { subscriptionId: subId, isOwner: true },
        });
        if (owner) {
          if (isPaid) {
            await tx.subscriptionPayment.upsert({
              where: { memberId_month_year: { memberId: owner.id, month: subMonth, year: subYear } },
              create: { memberId: owner.id, month: subMonth, year: subYear },
              update: { paidAt: new Date() },
            });
          } else {
            await tx.subscriptionPayment.deleteMany({
              where: { memberId: owner.id, month: subMonth, year: subYear },
            });
          }
        }
      }

      // Sync loan bank entry and loan payment when a loan-tx-* transaction changes
      if (transaction.groupId?.startsWith("loan-tx-")) {
        const parts = transaction.groupId.split("-");
        const year  = parseInt(parts[parts.length - 1]);
        const month = parseInt(parts[parts.length - 2]);
        const loanId = parts.slice(2, parts.length - 2).join("-");
        await tx.bankEntry.updateMany({
          where: { userId: uid, groupId: `loan-entry-${loanId}-${month}-${year}` },
          data: { isPaid },
        });
        if (isPaid) {
          await tx.loanPayment.upsert({
            where: { loanId_month_year: { loanId, month, year } },
            create: { loanId, month, year },
            update: { paidAt: new Date() },
          });
        } else {
          await tx.loanPayment.deleteMany({ where: { loanId, month, year } });
        }
      }

      return transaction;
    });

    if (!transaction) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    await recordAudit({
      userId: uid, action: isPaid ? "PAY" : "UNPAY", entity: "transaction", entityId: id,
      after: { isPaid, amount: Number(transaction.amount), description: transaction.description, groupId: transaction.groupId },
      ip: ipFromRequest(req),
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("[transactions PATCH]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
