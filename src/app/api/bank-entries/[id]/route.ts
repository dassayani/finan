import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { CategoryKey } from "@/lib/constants";

const putSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { description, amount, category } = parsed.data;
  const entry = await prisma.bankEntry.update({
    where: { id, userId: session.user.id },
    data: { description, amount, category: (category as CategoryKey) ?? null },
  });
  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ isPaid: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { isPaid } = parsed.data;
  const entry = await prisma.bankEntry.findFirst({ where: { id, userId: session.user.id } });
  if (!entry) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const updated = await prisma.bankEntry.update({ where: { id }, data: { isPaid } });

  // Sync linked Transaction when BankEntry isPaid changes
  if (entry.groupId?.startsWith("salary-entry-")) {
    // groupId = "salary-entry-{userId}-{month}-{year}"
    const parts = entry.groupId.split("-");
    const year = parseInt(parts[parts.length - 1]);
    const month = parseInt(parts[parts.length - 2]);
    await prisma.transaction.updateMany({
      where: {
        userId: session.user.id, type: "INCOME",
        groupId: `salary-${session.user.id}`,
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        },
      },
      data: { isPaid },
    });
  } else if (entry.groupId?.startsWith("bonus-entry-")) {
    // groupId = "bonus-entry-{type}-{year}-{payMonth}-{userId}"
    const txGroupId = entry.groupId.replace("bonus-entry-", "bonus-");
    await prisma.transaction.updateMany({
      where: { userId: session.user.id, groupId: txGroupId },
      data: { isPaid },
    });
  } else if (entry.groupId?.startsWith("credit-entry-")) {
    // groupId = "credit-entry-{transactionId}"
    const txId = entry.groupId.slice("credit-entry-".length);
    const txExists = await prisma.transaction.findFirst({ where: { id: txId, userId: session.user.id } });
    if (txExists) {
      await prisma.transaction.update({ where: { id: txId }, data: { isPaid } });
    }
  } else if (entry.groupId?.startsWith("sub-entry-")) {
    // groupId = "sub-entry-{subId}-{memberId}-{month}-{year}"
    const [, , , memberId, monthStr, yearStr] = entry.groupId.split("-");
    const month = parseInt(monthStr);
    const year  = parseInt(yearStr);
    if (isPaid) {
      await prisma.subscriptionPayment.upsert({
        where: { memberId_month_year: { memberId, month, year } },
        create: { memberId, month, year },
        update: { paidAt: new Date() },
      });
    } else {
      await prisma.subscriptionPayment.deleteMany({ where: { memberId, month, year } });
    }
  } else if (entry.groupId?.startsWith("loan-entry-")) {
    // groupId = "loan-entry-{loanId}-{month}-{year}"
    const parts = entry.groupId.split("-");
    const year  = parseInt(parts[parts.length - 1]);
    const month = parseInt(parts[parts.length - 2]);
    const loanId = parts.slice(2, parts.length - 2).join("-");
    if (isPaid) {
      await prisma.loanPayment.upsert({
        where: { loanId_month_year: { loanId, month, year } },
        create: { loanId, month, year },
        update: { paidAt: new Date() },
      });
      // Also sync the transaction
      const txGroupId = `loan-tx-${loanId}-${month}-${year}`;
      await prisma.transaction.updateMany({
        where: { userId: session.user.id, groupId: txGroupId },
        data: { isPaid: true },
      });
    } else {
      await prisma.loanPayment.deleteMany({ where: { loanId, month, year } });
      const txGroupId = `loan-tx-${loanId}-${month}-${year}`;
      await prisma.transaction.updateMany({
        where: { userId: session.user.id, groupId: txGroupId },
        data: { isPaid: false },
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  await prisma.bankEntry.delete({ where: { id, userId: session.user.id } });
  return new NextResponse(null, { status: 204 });
}
