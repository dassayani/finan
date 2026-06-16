/**
 * Trilha de auditoria (Nível 7) — quem/quando/antes/depois.
 *
 * DESIGN: best-effort e NÃO-BLOQUEANTE. A escrita do log nunca propaga erro para
 * a operação financeira que a originou. Motivo: a tabela `audit_logs` é criada via
 * SQL manual (a migration history está quebrada) e pode não existir num deploy
 * intermediário — não podemos derrubar um pagamento porque o log falhou. Por isso
 * é chamado DEPOIS do commit da transação principal, dentro de try/catch.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "PAY" | "UNPAY" | "RECONCILE_ALERT";

export interface AuditInput {
  userId: string;
  action: AuditAction;
  entity: string;          // "credit" | "transaction" | "reconciliation" | ...
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

type DbClient = typeof prisma | Prisma.TransactionClient;

/** Registra um evento de auditoria. Nunca lança — falha é logada e engolida. */
export async function recordAudit(input: AuditInput, db: DbClient = prisma): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before === undefined ? undefined : (input.before as Prisma.InputJsonValue),
        after: input.after === undefined ? undefined : (input.after as Prisma.InputJsonValue),
        ip: input.ip ?? null,
      },
    });
  } catch (error) {
    // Auditoria é best-effort: logar e seguir. NUNCA quebrar o fluxo financeiro.
    console.error("[audit] falha ao registrar", input.action, input.entity, error);
  }
}

/** Extrai o IP do cliente dos headers (proxy-aware). */
export function ipFromRequest(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}
