import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BANKS, CATEGORIES } from "@/lib/constants";
import type { BankKey, CategoryKey } from "@/lib/constants";
import type { Prisma } from "@prisma/client";
import { buildCreditMirrorData } from "@/lib/finance/mirror";

const bankKeySchema = z.string().refine((v): v is BankKey => v in BANKS, { message: "Banco inválido" });
const categoryKeySchema = z.string().refine((v): v is CategoryKey => v in CATEGORIES, { message: "Categoria inválida" });

const updateSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: categoryKeySchema.nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Data inválida"),
  notes: z.string().nullable().optional(),
  bank: bankKeySchema.nullable().optional(),
  customBankId: z.string().nullable().optional(),
}).refine(d => !(d.bank && d.customBankId), { message: "Informe apenas bank ou customBankId", path: ["customBankId"] });

/** Atualiza a receita e recria o lançamento bancário espelho atomicamente. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  try {
    const { id } = await params;
    const data = updateSchema.parse(await req.json());
    const bank = data.bank ?? null;
    const customBankId = data.customBankId ?? null;
    const hasBank = !!(bank || customBankId);

    if (customBankId) {
      const cb = await prisma.customBank.findUnique({ where: { id: customBankId }, select: { userId: true } });
      if (!cb || cb.userId !== uid) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.transaction.updateMany({
        where: { id, userId: uid, type: "INCOME" },
        data: {
          description: data.description,
          amount: data.amount,
          category: (data.category as CategoryKey) ?? null,
          date: new Date(data.date),
          notes: data.notes ?? null,
          bank,
        },
      });
      if (updated.count === 0) return null;

      // Recria o espelho: remove o antigo e cria o novo se houver banco
      const existing = await tx.bankEntry.findFirst({ where: { userId: uid, groupId: `credit-entry-${id}` }, select: { isPaid: true } });
      await tx.bankEntry.deleteMany({ where: { userId: uid, groupId: `credit-entry-${id}` } });
      if (hasBank) {
        await tx.bankEntry.create({
          data: buildCreditMirrorData({
            userId: uid, transactionId: id, bank, customBankId,
            dateStr: data.date, description: data.description, amount: data.amount,
            category: (data.category as CategoryKey) ?? null,
            isPaid: existing?.isPaid ?? false,
          }),
        });
      }
      return true;
    });

    if (!result) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    console.error("[credits PUT]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Exclui a receita e o lançamento bancário espelho atomicamente. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  const { id } = await params;
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.transaction.deleteMany({ where: { id, userId: uid } });
    await tx.bankEntry.deleteMany({ where: { userId: uid, groupId: `credit-entry-${id}` } });
  });
  return new NextResponse(null, { status: 204 });
}
