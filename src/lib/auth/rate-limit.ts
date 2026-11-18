import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { anonymize } from "./tokens";

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
  // Limpeza oportunista (cerca de 1 a cada 50 chamadas): a tabela não cresce sem controle.
  if (Math.random() < 0.02) await pruneRateLimits().catch(() => undefined);
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

/**
 * Limpeza de registros antigos (chamada de forma oportunista por `consumeRateLimit`). Só apaga contadores cuja
 * janela já venceu (a maior janela em uso é de 24 h) e que não estejam com bloqueio em vigor.
 */
export async function pruneRateLimits(olderThanMs = 25 * 60 * 60 * 1000): Promise<void> {
  const now = Date.now();
  await db
    .delete(rateLimits)
    .where(
      and(
        lt(rateLimits.windowStart, new Date(now - olderThanMs)),
        or(isNull(rateLimits.blockedUntil), lt(rateLimits.blockedUntil, new Date(now))),
      ),
    );
}

/** Chave do contador de tentativas de login por e-mail (barreira contra ataque distribuído a uma conta). */
export function loginEmailKey(email: string): string {
  return `login:email:${anonymize(email.trim().toLowerCase())}`;
}

/**
 * Destrava o login de uma conta: zera o contador por e-mail. Chamado quando a senha é redefinida por um caminho
 * que prova quem é o dono (link do e-mail, senha gerada por um administrador, linha de comando).
 */
export async function unlockLogin(email: string): Promise<void> {
  await resetRateLimit(loginEmailKey(email));
}

export function retryMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1
    ? "Muitas tentativas. Aguarde um minuto e tente de novo."
    : `Muitas tentativas. Tente de novo em ${minutes} minutos.`;
}
