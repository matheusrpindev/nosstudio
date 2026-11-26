/**
 * Lembretes de compromissos (lógica pura, testada em `reminders.test.ts`): QUANDO um lembrete vence.
 *
 * Tudo em "hora do estúdio": o início de uma ocorrência é `YYYY-MM-DDTHH:mm` no fuso do estúdio (o mesmo
 * formato de `nowLocal()`), e a conta é feita em minutos de relógio de parede — quem chama converte o instante
 * atual para a hora do estúdio antes. Compromisso de dia inteiro conta a partir de `AGENDA_ALL_DAY_REMINDER_TIME`.
 */
import type { ISODate } from "@/lib/dates";

/** Minutos desde 1970 de um horário local `YYYY-MM-DDTHH:mm` (sem fuso: relógio de parede). */
export function wallMinutes(local: string): number {
  const [date, time = "00:00"] = local.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 60_000);
}

/** Início local de uma ocorrência (`allDayTime` vale para compromissos sem hora). */
export function occurrenceStart(date: ISODate, startTime: string | null, allDayTime: string): string {
  return `${date}T${startTime ?? allDayTime}`;
}

/** Tolerância depois do início: um lembrete "na hora" ainda sai se o despachante atrasar alguns minutos. */
export const REMINDER_GRACE_MIN = 10;

/**
 * O lembrete de `minutes` antes de `start` deve sair AGORA (`now`, hora local do estúdio)?
 * Sai do momento em que vence até `REMINDER_GRACE_MIN` minutos depois do início do compromisso — depois disso,
 * avisar não ajuda mais ninguém. `notBefore` (hora local em que o compromisso foi criado) evita "lembrar" de um
 * prazo que já tinha passado quando o compromisso nasceu (ex.: "7 dias antes" num compromisso criado na véspera).
 */
export function reminderIsDue(start: string, minutes: number, now: string, notBefore?: string | null): boolean {
  const startMin = wallMinutes(start);
  const due = startMin - minutes;
  const current = wallMinutes(now);
  if (current < due || current > startMin + REMINDER_GRACE_MIN) return false;
  return !notBefore || due >= wallMinutes(notBefore);
}

/** "em 15 minutos", "em 1 hora", "em 1 dia", "em 3 dias", "agora". */
export function leadText(minutes: number): string {
  if (minutes <= 0) return "agora";
  if (minutes < 60) return `em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  if (minutes < 1440) {
    const hours = Math.round(minutes / 60);
    return `em ${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  const days = Math.round(minutes / 1440);
  return `em ${days} ${days === 1 ? "dia" : "dias"}`;
}
