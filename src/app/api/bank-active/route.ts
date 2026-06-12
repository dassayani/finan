import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns all bank keys that have ever had activity for the user (across all months).
// Used to keep bank cards visible in months with no current activity.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const uid = session.user.id;

  const [balBanks, entryBanks, txBanks, feeBanks, configBanks] = await Promise.all([
    prisma.bankBalance.findMany({ where: { userId: uid }, select: { bank: true }, distinct: ["bank"] }),
    prisma.bankEntry.findMany({ where: { userId: uid, bank: { not: null } }, select: { bank: true }, distinct: ["bank"] }),
    prisma.transaction.findMany({ where: { userId: uid, bank: { not: null } }, select: { bank: true }, distinct: ["bank"] }),
    prisma.bankFee.findMany({ where: { userId: uid }, select: { bank: true }, distinct: ["bank"] }),
    prisma.bankConfig.findMany({ where: { userId: uid }, select: { bank: true } }),
  ]);

  const banks = new Set<string>();
  [...balBanks, ...entryBanks, ...txBanks, ...feeBanks, ...configBanks].forEach(r => {
    if (r.bank) banks.add(r.bank);
  });

  return NextResponse.json({ banks: [...banks] });
}
