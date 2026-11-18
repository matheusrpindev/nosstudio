/**
 * Situação de cada aviso da barra do topo, na mesma regra do site público
 * (`AnnouncementBar`): só o PRIMEIRO aviso ligado e dentro do período aparece.
 * Arquivo puro (sem banco) para ser testado e usado em qualquer lugar.
 */
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
