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
