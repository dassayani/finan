import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  // Prevent deleting the template if it's the only salary
  const salary = await prisma.salary.findFirst({ where: { id, userId: session.user.id } });
  if (!salary) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.salary.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
