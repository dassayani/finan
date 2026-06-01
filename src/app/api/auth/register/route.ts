import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
      select: { id: true, name: true, email: true },
    });

    await prisma.category.createMany({
      data: [
        { name: "Alimentação", color: "#ef4444", icon: "🍔", userId: user.id },
        { name: "Transporte", color: "#f97316", icon: "🚗", userId: user.id },
        { name: "Saúde", color: "#22c55e", icon: "💊", userId: user.id },
        { name: "Lazer", color: "#3b82f6", icon: "🎮", userId: user.id },
        { name: "Moradia", color: "#8b5cf6", icon: "🏠", userId: user.id },
        { name: "Salário", color: "#10b981", icon: "💰", userId: user.id },
        { name: "Investimentos", color: "#06b6d4", icon: "📈", userId: user.id },
        { name: "Outros", color: "#6b7280", icon: "📦", userId: user.id },
      ],
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
