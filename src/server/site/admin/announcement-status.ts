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
 * Com quanta antecedência (minutos) um aviso agendado já pode entrar no HTML das páginas públicas — ainda
 * escondido. Precisa cobrir o tempo máximo que uma página fica em cache (`expire` do perfil "site" em
 * next.config.ts = 1 hora): assim o aviso aparece na hora marcada mesmo numa página gerada pouco antes, e
 * nunca vai para o código-fonte do site dias ou meses antes da data combinada.
 */
export const ANNOUNCEMENT_LEAD_MINUTES = 60;

/**
 * Quais avisos LIGADOS podem ser enviados ao navegador agora (lista para o cache das páginas públicas):
 * - encerrados ficam de fora;
 * - agendados para além da antecedência ficam de fora (o texto não pode vazar antes da hora);
 * - agendados para os próximos minutos vão marcados com `pending: true`: o HTML os traz escondidos e só o
 *   script da barra (que confere o relógio do visitante no fuso do estúdio) os revela na hora certa.
 */
export function servableAnnouncements<T extends { startsAt: string | null; endsAt: string | null }>(
  rows: readonly T[],
  now: Date,
  leadMinutes = ANNOUNCEMENT_LEAD_MINUTES,
): (T & { pending: boolean })[] {
  const current = nowLocal(now);
  const horizon = nowLocal(new Date(now.getTime() + leadMinutes * 60_000));
  return rows
    .filter((row) => (!row.endsAt || row.endsAt > current) && (!row.startsAt || row.startsAt <= horizon))
    .map((row) => ({ ...row, pending: Boolean(row.startsAt && row.startsAt > current) }));
}
