/**
 * Rate limiter de janela deslizante, em memória.
 *
 * ⚠️ LIMITAÇÃO: em serverless (Vercel) o estado é POR INSTÂNCIA — não é um limite
 * global. Serve como defesa best-effort contra brute force/abuso simples. Para um
 * limite real e distribuído, trocar por Upstash Redis / @vercel/kv mantendo esta
 * mesma assinatura.
 */

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

// Limpeza preguiçosa para o Map não crescer indefinidamente.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * @param key      identificador (ex.: `register:${ip}` ou `login:${email}`)
 * @param limit    máximo de tentativas na janela
 * @param windowMs tamanho da janela em ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (hit.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((hit.resetAt - now) / 1000) };
  }

  hit.count += 1;
  return { ok: true, remaining: limit - hit.count, retryAfterSeconds: 0 };
}

/** Extrai um identificador de cliente a partir dos headers (proxy-aware). */
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}
