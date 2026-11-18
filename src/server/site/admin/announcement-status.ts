/**
 * Situação de cada aviso da barra do topo, na mesma regra do site público
 * (`AnnouncementBar`): só o PRIMEIRO aviso ligado e dentro do período aparece.
 * Arquivo puro (sem banco) para ser testado e usado em qualquer lugar.
 */
import { nowLocal } from "@/lib/dates";

export type AnnouncementTiming = { id: number; enabled: boolean; startsAt: string | null; endsAt: string | null };

export type AnnouncementStatus =
  | "no_ar" // é o aviso que aparece agora
  | "na_fila" // ligado e dentro do período, mas há outro antes dele na lista
  | "agendado" // ligado, o período ainda não começou
  | "encerrado" // ligado, o período já terminou
  | "desligado";

/** `now`: horário local do estúdio `YYYY-MM-DDTHH:mm` (`nowLocal()`). */
export function announcementStatuses(items: readonly AnnouncementTiming[], now: string): Map<number, AnnouncementStatus> {
  const result = new Map<number, AnnouncementStatus>();
  let liveFound = false;
  for (const item of items) {
    if (!item.enabled) result.set(item.id, "desligado");
    else if (item.endsAt && item.endsAt <= now) result.set(item.id, "encerrado");
    else if (item.startsAt && item.startsAt > now) result.set(item.id, "agendado");
    else if (!liveFound) {
      liveFound = true;
      result.set(item.id, "no_ar");
    } else result.set(item.id, "na_fila");
  }
  return result;
}

/**
 * Quais avisos LIGADOS podem ser enviados ao navegador agora (lista para o cache das páginas públicas): só os
 * que JÁ COMEÇARAM e ainda não terminaram. Um aviso agendado não sai do servidor nem um minuto antes — o
 * texto, o link e a data não podem aparecer no código-fonte do site antes da hora combinada (nem escondidos).
 * Para ele entrar no ar na hora, o cache das páginas é renovado no instante da próxima mudança
 * (`secondsToNextAnnouncementChange`).
 */
export function servableAnnouncements<T extends { startsAt: string | null; endsAt: string | null }>(rows: readonly T[], now: Date): T[] {
  const current = nowLocal(now);
  return rows.filter((row) => (!row.endsAt || row.endsAt > current) && (!row.startsAt || row.startsAt <= current));
}

/** Minutos entre dois horários locais `YYYY-MM-DDTHH:mm` (b − a), tratados como relógio de parede. */
function localMinutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60_000);
}

/**
 * Em quantos segundos a lista de `servableAnnouncements` muda (o próximo início ou fim entre os avisos ligados).
 * `null` = nenhuma mudança agendada. Usado para o cache das páginas públicas vencer na hora em que um aviso
 * começa ou termina. (Conta pelo relógio de parede do estúdio; numa virada de horário de verão o valor pode
 * errar por uma hora, mas ele é recalculado a cada renovação do cache, no máximo a cada 5 minutos.)
 */
export function secondsToNextAnnouncementChange(rows: readonly { startsAt: string | null; endsAt: string | null }[], now: Date): number | null {
  const current = nowLocal(now);
  let next: number | null = null;
  for (const row of rows) {
    if (row.endsAt && row.endsAt <= current) continue; // já encerrado: não muda mais
    for (const boundary of [row.startsAt, row.endsAt]) {
      if (!boundary || boundary <= current) continue;
      const minutes = localMinutesBetween(current, boundary);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;
      const seconds = minutes * 60 - now.getUTCSeconds();
      if (next === null || seconds < next) next = seconds;
    }
  }
  return next === null ? null : Math.max(1, next);
}

/** Os tempos do perfil de cache "site" (next.config.ts), em segundos. */
const SITE_CACHE = { stale: 300, revalidate: 300, expire: 3600 } as const;
/** Abaixo disto (5 min) o Next trata o cache como dinâmico e a página deixaria de ser estática. */
const MIN_EXPIRE = 300;

/**
 * Tempo de vida do cache da lista de avisos (`cacheLife`), para um aviso agendado entrar no ar na hora H.
 * Sem mudança na próxima hora, vale o perfil normal do site. Com mudança daqui a `s` segundos:
 * - `expire` = s (nunca menos de 5 min, senão o Next deixaria a página dinâmica): numa página que ninguém
 *   visitou desde que foi gerada, a primeira visita depois de H espera a página nova, já com o aviso;
 * - `revalidate` = s / 2 (no máximo os 5 min do site): o Next repassa estes tempos INTEIROS a qualquer página
 *   que reaproveite a lista, contados a partir da geração da página — não do momento em que a lista foi lida do
 *   banco. Com metade do tempo, uma página gerada enquanto a lista ainda vale fica "velha" antes de H, e a
 *   primeira visita depois de H dispara a página nova. No pior caso, UMA visita por página ainda recebe a
 *   versão anterior.
 * (Conferido com requisições reais num servidor de produção, com páginas visitadas e não visitadas antes de H.)
 */
export function announcementCacheLife(nextChangeSeconds: number | null): "site" | { stale: number; revalidate: number; expire: number } {
  if (nextChangeSeconds === null || nextChangeSeconds > SITE_CACHE.expire) return "site";
  return {
    stale: SITE_CACHE.stale,
    revalidate: Math.max(1, Math.min(SITE_CACHE.revalidate, Math.floor(nextChangeSeconds / 2))),
    expire: Math.max(MIN_EXPIRE, nextChangeSeconds),
  };
}
