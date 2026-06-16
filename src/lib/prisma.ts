import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Conexão do runtime.
  //
  // ⚠️ ESCALABILIDADE (ver auditoria): hoje usamos DIRECT_URL (porta 5432, session
  // mode) porque o adapter pg não fala o protocolo do pgbouncer em transaction
  // mode. Em serverless (Vercel) isso significa SEM pooling: cada instância de
  // função abre conexões diretas ao Postgres e, sob concorrência, esgota o limite
  // de conexões do Supabase. Caminho recomendado quando for escalar:
  //   - usar a Pooled URL do Supabase (transaction mode) para o runtime, e
  //   - manter DIRECT_URL apenas para migrations,
  //   - ou adotar Prisma Accelerate.
  // Mantido como está para não quebrar o ambiente atual sem validação em banco real.
  const connectionString = process.env.DATABASE_URL_RUNTIME ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Singleton reaproveitado entre invocações/reloads — inclusive em produção. Sem
// isso, hot-reload (dev) e reuso de instância serverless (prod) podiam instanciar
// múltiplos PrismaClient, multiplicando conexões e acelerando o esgotamento do pool.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
