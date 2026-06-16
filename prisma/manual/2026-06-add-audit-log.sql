-- Tabela de auditoria (Nível 7) — alinhada ao model AuditLog do schema.prisma.
-- Idempotente. Aplicar com:
--   npx prisma db execute --file prisma/manual/2026-06-add-audit-log.sql --schema prisma/schema.prisma
-- Depois, `npx prisma db push` reconhece a tabela e não recria nada.

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "entity"     TEXT NOT NULL,
  "entity_id"  TEXT,
  "before"     JSONB,
  "after"      JSONB,
  "ip"         TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx" ON "audit_logs" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_entity_id_idx"   ON "audit_logs" ("entity", "entity_id");
