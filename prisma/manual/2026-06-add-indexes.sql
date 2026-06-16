-- Índices de performance — alinhados aos @@index do schema.prisma.
-- Idempotente: seguro rodar múltiplas vezes. Aplicar com:
--   npx prisma db execute --file prisma/manual/2026-06-add-indexes.sql --schema prisma/schema.prisma
-- Depois, `npx prisma db push` reconhece os índices e não recria nada.
--
-- Contexto: o banco foi criado via `db push` e a migration 0_init está corrompida
-- (contém stdout, não SQL). Estes CREATE INDEX IF NOT EXISTS contornam isso sem
-- depender da migration history.

-- transactions: caminho quente do dashboard, créditos, débito
CREATE INDEX IF NOT EXISTS "transactions_user_id_date_idx"      ON "transactions" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "transactions_user_id_group_id_idx"  ON "transactions" ("user_id", "group_id");
CREATE INDEX IF NOT EXISTS "transactions_user_id_bank_date_idx" ON "transactions" ("user_id", "bank", "date");

-- bank_entries: tela de bancos e agregação do dashboard
CREATE INDEX IF NOT EXISTS "bank_entries_user_id_month_year_idx" ON "bank_entries" ("user_id", "month", "year");
CREATE INDEX IF NOT EXISTS "bank_entries_user_id_group_id_idx"   ON "bank_entries" ("user_id", "group_id");

-- listagens por usuário (FK não é indexada automaticamente no Postgres)
CREATE INDEX IF NOT EXISTS "bank_fees_user_id_idx"     ON "bank_fees" ("user_id");
CREATE INDEX IF NOT EXISTS "investments_user_id_idx"   ON "investments" ("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "custom_banks_user_id_idx"  ON "custom_banks" ("user_id");
CREATE INDEX IF NOT EXISTS "loans_user_id_idx"         ON "loans" ("user_id");
