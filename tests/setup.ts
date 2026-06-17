// Carrega o .env para o processo de teste (o vitest não faz isso sozinho).
// `override: false` (default) garante que vars já definidas pelo CI tenham
// prioridade — só preenche o que faltar, ex.: DIRECT_URL para os testes real-db.
import dotenv from "dotenv";
dotenv.config();

process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? "test-secret";
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-google-client";
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "test-google-secret";
