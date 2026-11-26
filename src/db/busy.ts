/**
 * SQLite em arquivo aceita UM escritor por vez. O cliente libSQL mantém várias conexões ao mesmo arquivo, então
 * duas Server Actions simultâneas (ou uma action e um script, como o backup) disputam a trava de escrita — e a
 * que chega depois falha na hora com `SQLITE_BUSY: database is locked`, porque o tempo de espera padrão é zero.
 *
 * Aumentar o `busy_timeout` não resolve dentro do mesmo processo: o driver é síncrono, então a conexão que
 * espera trava o event loop e a transação que segura a trava nunca consegue chegar ao `commit`.
 *
 * A saída é tentar de novo com espera assíncrona. É seguro porque a trava só pode faltar em dois pontos, e em
 * ambos nada foi gravado ainda:
 *   - no `BEGIN IMMEDIATE` de uma transação (o libSQL abre toda transação já como escrita);
 *   - numa instrução avulsa (autocommit) ou num lote, que o SQLite desfaz por inteiro quando falha.
 * Dentro de uma transação aberta a trava já é nossa, e leituras nunca esperam (modo WAL).
 */
import type { Client } from "@libsql/client";

export type BusyRetryOptions = {
  /** Tempo total de espera antes de desistir e devolver o erro original. */
  maxWaitMs?: number;
  /** Primeira espera; dobra a cada tentativa até `maxDelayMs`. */
  baseDelayMs?: number;
  maxDelayMs?: number;
};

const DEFAULTS = { maxWaitMs: 8000, baseDelayMs: 5, maxDelayMs: 120 } as const;

/** `SQLITE_BUSY` (e variantes como `SQLITE_BUSY_SNAPSHOT`), inclusive quando vem embrulhado em `cause`. */
export function isBusyError(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    const { code, rawCode, message, cause } = current as {
      code?: unknown;
      rawCode?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (typeof code === "string" && code.startsWith("SQLITE_BUSY")) return true;
    if (rawCode === 5) return true;
    if (typeof message === "string" && /SQLITE_BUSY|database is locked/i.test(message)) return true;
    current = cause;
  }
  return false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Executa `run`; se o banco estiver ocupado, espera (sem travar o event loop) e tenta de novo. */
export async function retryWhenBusy<T>(run: () => Promise<T>, options: BusyRetryOptions = {}): Promise<T> {
  const { maxWaitMs, baseDelayMs, maxDelayMs } = { ...DEFAULTS, ...options };
  let waited = 0;
  let delay = Math.max(1, baseDelayMs);
  for (;;) {
    try {
      return await run();
    } catch (error) {
      if (!isBusyError(error) || waited >= maxWaitMs) throw error;
      const pause = Math.min(delay, maxDelayMs, maxWaitMs - waited);
      await sleep(pause);
      waited += pause;
      delay *= 2;
    }
  }
}

/** Operações do cliente que pegam a trava de escrita no início e podem ser repetidas sem efeito colateral. */
const RETRIED = new Set<PropertyKey>(["execute", "batch", "migrate", "executeMultiple", "transaction"]);

/**
 * Devolve o mesmo cliente com nova tentativa automática em caso de banco ocupado. As transações devolvidas
 * por `transaction()` não são embrulhadas: depois do `BEGIN` a trava já é da própria transação.
 */
export function withBusyRetry(client: Client, options: BusyRetryOptions = {}): Client {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target) as unknown;
      if (typeof value !== "function") return value;
      const method = value as (...args: unknown[]) => unknown;
      if (!RETRIED.has(prop)) return method.bind(target);
      return (...args: unknown[]) => retryWhenBusy(async () => method.apply(target, args), options);
    },
  });
}
