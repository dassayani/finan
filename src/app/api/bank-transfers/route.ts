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

const transferSchema = z.object({
  sourceBank:         z.string().nullable().optional(),
  sourceCustomBankId: z.string().nullable().optional(),
  sourceName:         z.string().min(1),
  destBank:           z.string().nullable().optional(),
  destCustomBankId:   z.string().nullable().optional(),
  destName:           z.string().min(1),
  amount:             z.number().positive(),
  description:        z.string().optional(),
  month:              z.number().int().min(1).max(12),
  year:               z.number().int().min(2000).max(2100),
}).superRefine((d, ctx) => {
  // Cada lado precisa de exatamente um identificador de banco (padrão XOR custom)
  if (!d.sourceBank === !d.sourceCustomBankId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceBank"], message: "Informe exatamente um banco de origem" });
  }
  if (!d.destBank === !d.destCustomBankId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destBank"], message: "Informe exatamente um banco de destino" });
  }
  // Origem e destino não podem ser o mesmo banco
  const sameStd    = d.sourceBank && d.destBank && d.sourceBank === d.destBank;
  const sameCustom = d.sourceCustomBankId && d.destCustomBankId && d.sourceCustomBankId === d.destCustomBankId;
  if (sameStd || sameCustom) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destBank"], message: "Origem e destino devem ser bancos diferentes" });
  }
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  try {
    const body = await req.json();
    const data = transferSchema.parse(body);

    const srcBank = toBankKey(data.sourceBank);
    const dstBank = toBankKey(data.destBank);
    const srcCustom = data.sourceCustomBankId ?? null;
    const dstCustom = data.destCustomBankId ?? null;

    // Banco padrão informado mas inválido (não está no enum)
    if ((data.sourceBank && !srcBank) || (data.destBank && !dstBank)) {
      return NextResponse.json({ error: "Banco inválido" }, { status: 400 });
    }

    // Ownership dos bancos customizados — impede referenciar banco de outro usuário
    const customIds = [srcCustom, dstCustom].filter((id): id is string => !!id);
    if (customIds.length > 0) {
      const owned = await prisma.customBank.findMany({
        where: { id: { in: customIds }, userId: uid },
        select: { id: true },
      });
      if (owned.length !== new Set(customIds).size) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
      }
    }

    const groupId = `transfer-${Date.now()}-${uid.slice(-6)}`;
    const label   = data.description?.trim() || "Transferência";
    const descOut = `${label} → ${data.destName}`;
    const descIn  = `${label} ← ${data.sourceName}`;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Saída no banco de origem
      await tx.bankEntry.create({
        data: {
          userId: uid,
          bank: srcBank,
          customBankId: srcCustom,
          month: data.month,
          year: data.year,
          description: descOut,
          amount: data.amount,
          type: "EXPENSE",
          category: null,
          groupId,
          isPaid: true,
        },
      });

      // Entrada no banco de destino
      await tx.bankEntry.create({
        data: {
          userId: uid,
          bank: dstBank,
          customBankId: dstCustom,
          month: data.month,
          year: data.year,
          description: descIn,
          amount: data.amount,
          type: "INCOME",
          category: null,
          groupId,
          isPaid: true,
        },
      });
    });

    return NextResponse.json({ ok: true, groupId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues.map(i => i.message).join("; ") }, { status: 400 });
    }
    console.error("[bank-transfers POST]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const uid = session.user.id;

  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  if (!groupId?.startsWith("transfer-")) {
    return NextResponse.json({ error: "groupId de transferência inválido" }, { status: 400 });
  }

  await prisma.bankEntry.deleteMany({ where: { userId: uid, groupId } });

  return new NextResponse(null, { status: 204 });
}
