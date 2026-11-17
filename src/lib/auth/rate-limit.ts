import "server-only";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitRule = {
  /** Máximo de tentativas dentro da janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
  /** Tempo de bloqueio ao estourar o limite (padrão: o tamanho da janela). */
  blockMs?: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Conta uma tentativa para `key` e diz se ela pode prosseguir.
 * Persistido no banco para sobreviver a reinícios do servidor.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(rateLimits).where(eq(rateLimits.key, key));
    if (row?.blockedUntil && row.blockedUntil.getTime() > now) {
      return { ok: false, retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - now) / 1000) } as const;
    }
    if (!row || now - row.windowStart.getTime() > rule.windowMs) {
      await tx
        .insert(rateLimits)
        .values({ key, count: 1, windowStart: new Date(now), blockedUntil: null })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { count: 1, windowStart: new Date(now), blockedUntil: null },
        });
      return { ok: true } as const;
    }
    const count = row.count + 1;
    if (count > rule.limit) {
      const blockedUntil = new Date(now + (rule.blockMs ?? rule.windowMs));
      await tx.update(rateLimits).set({ count, blockedUntil }).where(eq(rateLimits.key, key));
      return { ok: false, retryAfterSeconds: Math.ceil((blockedUntil.getTime() - now) / 1000) } as const;
    }
    await tx.update(rateLimits).set({ count }).where(eq(rateLimits.key, key));
    return { ok: true } as const;
  });
}

/** Zera o contador (ex.: depois de um login bem-sucedido). */
export async function resetRateLimit(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Limpeza ocasional de registros antigos (chamada de forma oportunista). */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - olderThanMs)));
}

export function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1
    ? "Muitas tentativas. Aguarde um minuto e tente de novo."
    : `Muitas tentativas. Tente de novo em ${minutes} minutos.`;
}
