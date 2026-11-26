/**
 * DESPACHANTE DE LEMBRETES DA AGENDA — idempotente: pode rodar a cada minuto, em mais de um processo, e o mesmo
 * lembrete nunca sai duas vezes.
 *
 * Para cada compromisso não cancelado com lembretes (inclusive cada ocorrência de uma série) cujo lembrete
 * venceu (`reminderIsDue`, na hora do estúdio):
 *  - cria a notificação interna para os responsáveis e participantes (sem ninguém marcado: para quem criou);
 *  - se o canal do lembrete é e-mail, envia também o e-mail (`sendMail`).
 * Compromisso particular: os destinatários são sempre as pessoas do próprio compromisso — ninguém mais recebe
 * nada. Cancelado não lembra. Conta desativada não recebe.
 *
 * A garantia de "uma vez só" é o índice único de `agenda_reminder_deliveries` (compromisso + início da
 * ocorrência + antecedência + canal + pessoa): a entrega só acontece depois de a linha ser inserida. Se o envio
 * do e-mail falhar, a linha fica com o status da falha e NÃO há nova tentativa (melhor um lembrete a menos do que
 * o mesmo e-mail repetido a cada minuto).
 *
 * Quem dispara: `src/server/notifications/timer.ts` (temporizador do servidor) ou `scripts/reminders.ts` (cron).
 */
import "server-only";
import { and, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { agendaEvents, agendaReminderDeliveries, users } from "@/db/schema";
import { expandEvent } from "@/lib/agenda/expand";
import { leadText, occurrenceStart, reminderIsDue } from "@/lib/agenda/reminders";
import { addDays, formatDate, formatWeekday, nowLocal, type ISODate } from "@/lib/dates";
import { AGENDA_ALL_DAY_REMINDER_TIME, AGENDA_REMINDER_MAX_MINUTES } from "@/lib/domain";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { busyPeople } from "@/server/agenda/conflicts";
import type { EventRecord } from "@/server/agenda/privacy";
import { eventHref } from "@/server/agenda/queries";
import { loadEventRecords, windowCondition } from "@/server/agenda/records";
import { createNotifications } from "./index";

export type DispatchResult = {
  /** Lembretes vencidos encontrados nesta passada (antes de conferir se já tinham saído). */
  due: number;
  notifications: number;
  emails: number;
  emailFailures: number;
};

const DELIVERY_RETENTION_DAYS = 60;

/** "hoje, 10:00" · "amanhã, 10:00" · "sexta-feira, 12/12/2026, 10:00" · "hoje (dia inteiro)". */
function whenText(date: ISODate, startTime: string | null, today: ISODate): string {
  const day = date === today ? "hoje" : date === addDays(today, 1) ? "amanhã" : `${formatWeekday(date)}, ${formatDate(date)}`;
  return startTime ? `${day}, ${startTime}` : `${day} (dia inteiro)`;
}

/** Tenta "pegar" a entrega: `true` só para quem inseriu a linha (os demais processos/passadas recebem `false`). */
async function claim(eventId: number, start: string, minutes: number, channel: "interno" | "email", userId: number): Promise<number | null> {
  const rows = await db
    .insert(agendaReminderDeliveries)
    .values({ eventId, occurrenceStart: start, minutes, channel, userId })
    .onConflictDoNothing()
    .returning({ id: agendaReminderDeliveries.id });
  return rows[0]?.id ?? null;
}

type Recipient = { id: number; name: string; email: string };

async function deliver(record: EventRecord, occurrence: { date: ISODate; recurring: boolean }, minutes: number, email: boolean, recipients: Recipient[], today: ISODate, result: DispatchResult) {
  const start = occurrenceStart(occurrence.date, record.startTime, AGENDA_ALL_DAY_REMINDER_TIME);
  const href = eventHref(record.id, occurrence.recurring ? occurrence.date : null);
  const when = whenText(occurrence.date, record.startTime, today);
  const body = [when.charAt(0).toUpperCase() + when.slice(1), record.location].filter(Boolean).join(" · ");
  for (const person of recipients) {
    // aviso no painel: sempre (uma vez por antecedência, qualquer que seja o canal marcado)
    if ((await claim(record.id, start, minutes, "interno", person.id)) !== null) {
      result.notifications += await createNotifications([{ userId: person.id, type: "agenda_lembrete", title: `Lembrete: ${record.title}`, body, href }]);
    }
    if (!email) continue;
    const deliveryId = await claim(record.id, start, minutes, "email", person.id);
    if (deliveryId === null) continue;
    const sent = await sendMail({
      to: person.email,
      subject: `Lembrete: ${record.title} — ${when}`,
      text: [
        `Olá, ${person.name.split(" ")[0]}.`,
        "",
        `Lembrete da agenda da NÓS (${leadText(minutes)}):`,
        "",
        record.title,
        `Quando: ${when}${record.startTime && record.endTime ? ` – ${record.endTime}` : ""}`,
        record.location ? `Onde: ${record.location}` : "",
        record.meetingUrl ? `Reunião: ${record.meetingUrl}` : "",
        "",
        `Abrir no painel: ${env.siteUrl}${href}`,
      ]
        .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
        .join("\n"),
    });
    if (sent.delivered) result.emails += 1;
    else {
      result.emailFailures += 1;
      await db
        .update(agendaReminderDeliveries)
        .set({ status: sent.reason === "smtp_not_configured" ? "sem_smtp" : "falhou" })
        .where(eq(agendaReminderDeliveries.id, deliveryId));
    }
  }
}

/** Uma passada do despachante. `now` é o instante atual (os testes passam outro). */
export async function dispatchAgendaReminders(now: Date = new Date()): Promise<DispatchResult> {
  const result: DispatchResult = { due: 0, notifications: 0, emails: 0, emailFailures: 0 };
  const local = nowLocal(now);
  const today = local.slice(0, 10);
  // de ontem (o que virou a noite e a tolerância depois do início) até a maior antecedência possível
  const from = addDays(today, -1);
  const to = addDays(today, Math.ceil(AGENDA_REMINDER_MAX_MINUTES / 1440) + 1);
  const records = await loadEventRecords(and(windowCondition(from, to), ne(agendaEvents.status, "cancelado"), sql`json_array_length(${agendaEvents.reminders}) > 0`));

  const pending: { record: EventRecord; occurrence: { date: ISODate; recurring: boolean }; minutes: number; email: boolean }[] = [];
  for (const record of records) {
    const createdLocal = nowLocal(record.createdAt);
    // a mesma antecedência com dois canais é UM aviso no painel e, se um deles for e-mail, um e-mail
    const byMinutes = new Map<number, boolean>();
    for (const reminder of record.reminders ?? []) byMinutes.set(reminder.minutes, (byMinutes.get(reminder.minutes) ?? false) || reminder.channel === "email");
    for (const occurrence of expandEvent(record, from, to)) {
      const start = occurrenceStart(occurrence.date, record.startTime, AGENDA_ALL_DAY_REMINDER_TIME);
      for (const [minutes, email] of byMinutes) {
        if (reminderIsDue(start, minutes, local, createdLocal)) pending.push({ record, occurrence, minutes, email });
      }
    }
  }
  result.due = pending.length;
  if (pending.length === 0) return result;

  const ids = [...new Set(pending.flatMap((entry) => busyPeople(entry.record)))];
  const people = ids.length ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(inArray(users.id, ids), eq(users.active, true))) : [];
  const byId = new Map(people.map((person) => [person.id, person]));
  for (const entry of pending) {
    const recipients = busyPeople(entry.record)
      .map((id) => byId.get(id))
      .filter((person): person is Recipient => person !== undefined);
    await deliver(entry.record, entry.occurrence, entry.minutes, entry.email, recipients, today, result);
  }
  return result;
}

/** Limpeza do controle de entregas: ocorrências que começaram há mais de 60 dias não precisam mais da trava. */
export async function pruneReminderDeliveries(now: Date = new Date()): Promise<number> {
  const limit = `${addDays(nowLocal(now).slice(0, 10), -DELIVERY_RETENTION_DAYS)}T00:00`;
  const rows = await db.delete(agendaReminderDeliveries).where(lt(agendaReminderDeliveries.occurrenceStart, limit)).returning({ id: agendaReminderDeliveries.id });
  return rows.length;
}
