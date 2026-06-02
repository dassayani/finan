import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
dotenv.config();

export default defineConfig({
  datasource: {
    // DIRECT_URL usa session mode (porta 5432) — necessário para DDL (migrations/push)
    // DATABASE_URL usa pgbouncer (porta 6543) — usado pelo app em runtime
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
