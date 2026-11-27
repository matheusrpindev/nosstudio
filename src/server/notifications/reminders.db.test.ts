/**
 * Despachante de lembretes e central de notificações, com banco de verdade:
 * - cada lembrete sai UMA vez (rodar de novo, ou duas passadas ao mesmo tempo, não repete);
 * - vence na hora do ESTÚDIO (America/Sao_Paulo), não em UTC;
 * - séries: cada ocorrência tem o seu lembrete; dia excluído da série não lembra;
 * - cancelado não lembra; particular só avisa as pessoas do próprio compromisso;
 * - cada pessoa só lê e só marca as SUAS notificações.
 *
 * Os compromissos ficam em 2034: longe de qualquer outro dado do banco de teste.
 */
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ sent: [] as { to: string | string[]; subject: string; text: string }[], fail: false }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (input: { to: string | string[]; subject: string; text: string }) => {
    if (mail.fail) return { delivered: false, reason: "send_failed" };
    mail.sent.push(input);
    return { delivered: true };
  },
}));

import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaEvents, agendaReminderDeliveries, notifications, users } from "@/db/schema";
import type { EventInput } from "@/server/agenda/input";
import { createEvent, deleteEventScoped, setEventStatus } from "@/server/agenda/mutations";
import { loadEventRecord } from "@/server/agenda/records";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";
import { countUnread, createNotifications, listNotifications, markAllRead, markRead, safeNotificationHref } from "./index";
import { dispatchAgendaReminders, pruneReminderDeliveries } from "./reminders";

let A: TestAccount; // cria os compromissos
let B: TestAccount; // participa de alguns
let C: TestAccount; // nunca participa
let categoryId = 0;
let calendarId = 0;

function input(over: Partial<EventInput>): EventInput {
  return {
    title: "[TesteL] compromisso",
    categoryId,
    calendarId,
    description: "",
    date: "2034-03-06",
    endDate: null,
    startTime: "10:00",
    endTime: "11:00",
    location: "",
    mapUrl: "",
    meetingUrl: "",
    clientId: null,
    projectId: null,
    priority: "normal",
    status: "confirmado",
    visibility: "normal",
    checklist: [],
    notes: "",
    reminders: [],
    recurrence: null,
    attachments: [],
    production: null,
    responsibleIds: [],
    participantIds: [],
    externalPeople: [],
    ...over,
  };
}

/** Instante em que o relógio do estúdio (UTC−3) marca `local` (`YYYY-MM-DDTHH:mm`). */
const at = (local: string) => new Date(`${local}:00-03:00`);
const mineOf = async (account: TestAccount) => (await listNotifications(account.id, { limit: 100 })).map((row) => row.title);
const deliveries = (eventId: number) => db.select().from(agendaReminderDeliveries).where(eq(agendaReminderDeliveries.eventId, eventId));

async function wipe() {
  const ids = [A.id, B.id, C.id];
  await db.delete(notifications).where(inArray(notifications.userId, ids));
  const events = await db.select({ id: agendaEvents.id }).from(agendaEvents).where(inArray(agendaEvents.createdBy, ids));
  if (events.length) await db.delete(agendaEvents).where(inArray(agendaEvents.id, events.map((row) => row.id)));
  mail.sent.length = 0;
  mail.fail = false;
}

beforeAll(async () => {
  A = await makeAccount("admin");
  B = await makeAccount("gestor");
  C = await makeAccount("admin");
  const [category] = await db.insert(agendaCategories).values({ name: "[TesteL] categoria", color: "rosa", icon: "heart" }).returning();
  const [calendar] = await db.insert(agendaCalendars).values({ name: "[TesteL] agenda", kind: "comercial", color: "azul" }).returning();
  categoryId = category.id;
  calendarId = calendar.id;
});
beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.delete(agendaCategories).where(eq(agendaCategories.id, categoryId));
  await db.delete(agendaCalendars).where(eq(agendaCalendars.id, calendarId));
  await removeAccounts();
});

describe("despachante: uma vez só, na hora do estúdio", () => {
  it("avisa responsáveis e participantes quando o lembrete vence; rodar de novo não repete", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] reunião", location: "Estúdio", reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id], participantIds: [B.id] }), A.id);
    // 08:59 no estúdio: ainda não venceu
    expect(await dispatchAgendaReminders(at("2034-03-06T08:59"))).toMatchObject({ due: 0, notifications: 0, emails: 0 });
    // 09:00: vence — um aviso para cada pessoa do compromisso, e só para elas
    expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ due: 1, notifications: 2, emails: 0 });
    expect(await mineOf(A)).toEqual(["Lembrete: [TesteL] reunião"]);
    expect(await mineOf(B)).toEqual(["Lembrete: [TesteL] reunião"]);
    expect(await mineOf(C)).toEqual([]);
    const [note] = await listNotifications(A.id);
    expect(note).toMatchObject({ type: "agenda_lembrete", body: "Hoje, 10:00 · Estúdio", href: `/painel/agenda/${id}`, readAt: null });
    // a passada seguinte (um minuto depois) e outra bem em cima do início: nada de novo
    expect(await dispatchAgendaReminders(at("2034-03-06T09:01"))).toMatchObject({ due: 1, notifications: 0, emails: 0 });
    expect(await dispatchAgendaReminders(at("2034-03-06T10:05"))).toMatchObject({ notifications: 0 });
    expect(await mineOf(A)).toHaveLength(1);
    expect(mail.sent).toEqual([]); // canal só "aviso no painel": nenhum e-mail
  });

  it("vence pelo relógio do estúdio, não em UTC (10:00 em São Paulo = 13:00 UTC)", async () => {
    await createEvent(input({ title: "[TesteL] fuso", reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    // 09:00 UTC seriam 06:00 no estúdio: se a conta fosse em UTC, sairia aqui
    expect(await dispatchAgendaReminders(new Date("2034-03-06T09:00:00Z"))).toMatchObject({ due: 0, notifications: 0 });
    expect(await dispatchAgendaReminders(new Date("2034-03-06T11:59:00Z"))).toMatchObject({ due: 0, notifications: 0 });
    expect(await dispatchAgendaReminders(new Date("2034-03-06T12:00:00Z"))).toMatchObject({ due: 1, notifications: 1 });
  });

  it("duas passadas ao mesmo tempo (servidor + cron): cada pessoa recebe um aviso e um e-mail, não dois", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] simultâneo", reminders: [{ minutes: 30, channel: "email" }], responsibleIds: [A.id], participantIds: [B.id] }), A.id);
    const now = at("2034-03-06T09:30");
    const results = await Promise.all([dispatchAgendaReminders(now), dispatchAgendaReminders(now), dispatchAgendaReminders(now)]);
    expect(results.reduce((sum, result) => sum + result.notifications, 0)).toBe(2);
    expect(results.reduce((sum, result) => sum + result.emails, 0)).toBe(2);
    expect(await mineOf(A)).toHaveLength(1);
    expect(await mineOf(B)).toHaveLength(1);
    expect(mail.sent.map((item) => item.to).sort()).toEqual([A.email, B.email].sort());
    const rows = await deliveries(id);
    expect(rows.map((row) => `${row.channel}:${row.userId}`).sort()).toEqual([`email:${A.id}`, `email:${B.id}`, `interno:${A.id}`, `interno:${B.id}`].sort());
    expect(rows.every((row) => row.occurrenceStart === "2034-03-06T10:00" && row.minutes === 30 && row.status === "enviado")).toBe(true);
  });

  it("canal e-mail: envia o e-mail além do aviso; a mesma antecedência com os dois canais é um aviso só", async () => {
    const { id } = await createEvent(
      input({ title: "[TesteL] com e-mail", location: "Sala 2", meetingUrl: "https://meet.exemplo/abc", reminders: [{ minutes: 60, channel: "interno" }, { minutes: 60, channel: "email" }, { minutes: 1440, channel: "interno" }], responsibleIds: [A.id] }),
      A.id,
    );
    // véspera, 10:00: o de 1 dia (só painel)
    expect(await dispatchAgendaReminders(at("2034-03-05T10:00"))).toMatchObject({ due: 1, notifications: 1, emails: 0 });
    expect((await listNotifications(A.id))[0].body).toBe("Amanhã, 10:00 · Sala 2");
    // no dia, 09:00: o de 1 hora — UM aviso (apesar dos dois canais) e um e-mail
    expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ notifications: 1, emails: 1 });
    expect(await mineOf(A)).toHaveLength(2);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]).toMatchObject({ to: A.email, subject: "Lembrete: [TesteL] com e-mail — hoje, 10:00" });
    expect(mail.sent[0].text).toContain(`/painel/agenda/${id}`);
    expect(mail.sent[0].text).toContain("Onde: Sala 2");
    expect(await dispatchAgendaReminders(at("2034-03-06T09:02"))).toMatchObject({ notifications: 0, emails: 0 });
  });

  it("falha no envio do e-mail fica registrada e NÃO vira nova tentativa a cada minuto", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] smtp fora", reminders: [{ minutes: 15, channel: "email" }], responsibleIds: [A.id] }), A.id);
    mail.fail = true;
    expect(await dispatchAgendaReminders(at("2034-03-06T09:45"))).toMatchObject({ notifications: 1, emails: 0, emailFailures: 1 });
    mail.fail = false;
    expect(await dispatchAgendaReminders(at("2034-03-06T09:46"))).toMatchObject({ notifications: 0, emails: 0, emailFailures: 0 });
    expect(mail.sent).toEqual([]);
    expect((await deliveries(id)).find((row) => row.channel === "email")?.status).toBe("falhou");
  });

  it("depois que o compromisso já começou faz tempo, o lembrete atrasado não sai mais", async () => {
    await createEvent(input({ title: "[TesteL] tarde demais", reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    expect(await dispatchAgendaReminders(at("2034-03-06T10:30"))).toMatchObject({ due: 0, notifications: 0 });
  });

  it("dia inteiro: conta a partir das 09:00 do dia", async () => {
    await createEvent(input({ title: "[TesteL] dia inteiro", startTime: null, endTime: null, reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    expect(await dispatchAgendaReminders(at("2034-03-06T07:59"))).toMatchObject({ notifications: 0 });
    expect(await dispatchAgendaReminders(at("2034-03-06T08:00"))).toMatchObject({ notifications: 1 });
    expect((await listNotifications(A.id))[0].body).toBe("Hoje (dia inteiro)");
  });

  it("mudar o horário rearma o lembrete (a trava é por início da ocorrência)", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] remarcado", reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ notifications: 1 });
    await db.update(agendaEvents).set({ startTime: "15:00", endTime: "16:00" }).where(eq(agendaEvents.id, id));
    expect(await dispatchAgendaReminders(at("2034-03-06T09:05"))).toMatchObject({ notifications: 0 });
    expect(await dispatchAgendaReminders(at("2034-03-06T14:00"))).toMatchObject({ notifications: 1 });
    expect(await mineOf(A)).toHaveLength(2);
  });
});

describe("séries, cancelados, particulares e contas desativadas", () => {
  it("série semanal: cada ocorrência avisa uma vez, com o link do dia; dia excluído não avisa", async () => {
    // toda segunda às 15:00, a partir de 03/04/2034
    const { id } = await createEvent(input({ title: "[TesteL] pauta semanal", date: "2034-04-03", startTime: "15:00", endTime: "16:00", recurrence: { freq: "semanal", interval: 1 }, reminders: [{ minutes: 30, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    await deleteEventScoped((await loadEventRecord(id))!, "este", "2034-04-17");

    expect(await dispatchAgendaReminders(at("2034-04-03T14:30"))).toMatchObject({ notifications: 1 });
    expect(await dispatchAgendaReminders(at("2034-04-03T14:31"))).toMatchObject({ notifications: 0 });
    // terça: não é dia da série
    expect(await dispatchAgendaReminders(at("2034-04-04T14:30"))).toMatchObject({ due: 0, notifications: 0 });
    // segunda seguinte: nova ocorrência, novo aviso
    expect(await dispatchAgendaReminders(at("2034-04-10T14:30"))).toMatchObject({ notifications: 1 });
    // 17/04 foi excluída da série ("só este"): nada
    expect(await dispatchAgendaReminders(at("2034-04-17T14:30"))).toMatchObject({ due: 0, notifications: 0 });
    expect(await dispatchAgendaReminders(at("2034-04-24T14:45"))).toMatchObject({ notifications: 1 });

    const notes = await listNotifications(A.id, { limit: 10 });
    expect(notes.map((note) => note.href).sort()).toEqual([`/painel/agenda/${id}?dia=2034-04-03`, `/painel/agenda/${id}?dia=2034-04-10`, `/painel/agenda/${id}?dia=2034-04-24`]);
    expect((await deliveries(id)).map((row) => row.occurrenceStart).sort()).toEqual(["2034-04-03T15:00", "2034-04-10T15:00", "2034-04-24T15:00"]);
  });

  it("cancelado não lembra — nem o compromisso avulso, nem a ocorrência cancelada de uma série", async () => {
    await createEvent(input({ title: "[TesteL] cancelado", status: "cancelado", reminders: [{ minutes: 60, channel: "email" }], responsibleIds: [A.id] }), A.id);
    const { id } = await createEvent(input({ title: "[TesteL] série com um cancelado", date: "2034-05-01", recurrence: { freq: "diaria", interval: 1, count: 3 }, reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    await setEventStatus((await loadEventRecord(id))!, "cancelado", "este", "2034-05-02", A.id);

    expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ due: 0, notifications: 0, emails: 0 });
    expect(await dispatchAgendaReminders(at("2034-05-01T09:00"))).toMatchObject({ notifications: 1 });
    expect(await dispatchAgendaReminders(at("2034-05-02T09:00"))).toMatchObject({ due: 0, notifications: 0 });
    expect(await dispatchAgendaReminders(at("2034-05-03T09:00"))).toMatchObject({ notifications: 1 });
    expect(mail.sent).toEqual([]);
  });

  it("particular: só as pessoas do próprio compromisso recebem (aviso e e-mail)", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] consulta particular", visibility: "particular", reminders: [{ minutes: 60, channel: "email" }], responsibleIds: [A.id], participantIds: [B.id] }), A.id);
    expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ notifications: 2, emails: 2 });
    expect(await mineOf(C)).toEqual([]);
    expect(mail.sent.map((item) => item.to).sort()).toEqual([A.email, B.email].sort());
    expect((await deliveries(id)).some((row) => row.userId === C.id)).toBe(false);
    // em nenhuma notificação de outra pessoa aparece o título
    const others = await db.select().from(notifications).where(and(eq(notifications.title, "Lembrete: [TesteL] consulta particular")));
    expect(others.map((row) => row.userId).sort()).toEqual([A.id, B.id].sort());
  });

  it("sem ninguém marcado, avisa quem criou; conta desativada não recebe", async () => {
    await createEvent(input({ title: "[TesteL] só meu", reminders: [{ minutes: 60, channel: "interno" }] }), A.id);
    await createEvent(input({ title: "[TesteL] com inativo", startTime: "11:00", endTime: "12:00", reminders: [{ minutes: 120, channel: "email" }], responsibleIds: [B.id], participantIds: [C.id] }), A.id);
    await db.update(users).set({ active: false }).where(eq(users.id, C.id));
    try {
      expect(await dispatchAgendaReminders(at("2034-03-06T09:00"))).toMatchObject({ due: 2, notifications: 2, emails: 1 });
      expect(await mineOf(A)).toEqual(["Lembrete: [TesteL] só meu"]);
      expect(await mineOf(B)).toEqual(["Lembrete: [TesteL] com inativo"]);
      expect(await mineOf(C)).toEqual([]);
      expect(mail.sent.map((item) => item.to)).toEqual([B.email]);
    } finally {
      await db.update(users).set({ active: true }).where(eq(users.id, C.id));
    }
  });

  it("limpeza: a trava de entregas antigas é apagada; as recentes ficam", async () => {
    const { id } = await createEvent(input({ title: "[TesteL] antigo", reminders: [{ minutes: 60, channel: "interno" }], responsibleIds: [A.id] }), A.id);
    await dispatchAgendaReminders(at("2034-03-06T09:00"));
    expect(await deliveries(id)).toHaveLength(1);
    await pruneReminderDeliveries(at("2034-04-01T12:00"));
    expect(await deliveries(id)).toHaveLength(1);
    await pruneReminderDeliveries(at("2034-06-01T12:00"));
    expect(await deliveries(id)).toHaveLength(0);
  });
});

describe("central de notificações: cada pessoa só alcança as suas", () => {
  it("listar, contar e marcar como lida filtram pela pessoa — o id de outra pessoa não serve de chave", async () => {
    await createNotifications([
      { userId: A.id, type: "agenda_lembrete", title: "[TesteL] para A 1", href: "/painel/agenda/1" },
      { userId: A.id, type: "agenda_lembrete", title: "[TesteL] para A 2" },
      { userId: B.id, type: "agenda_lembrete", title: "[TesteL] para B" },
    ]);
    expect(await countUnread(A.id)).toBe(2);
    expect(await countUnread(B.id)).toBe(1);
    expect((await mineOf(A)).sort()).toEqual(["[TesteL] para A 1", "[TesteL] para A 2"]);
    expect(await mineOf(B)).toEqual(["[TesteL] para B"]);

    const [ofB] = await listNotifications(B.id);
    // A tenta marcar a notificação de B: nada muda
    expect(await markRead(A.id, [ofB.id])).toBe(0);
    expect(await countUnread(B.id)).toBe(1);
    // B marca a dela
    expect(await markRead(B.id, [ofB.id])).toBe(1);
    expect(await markRead(B.id, [ofB.id])).toBe(0); // já estava lida
    expect(await countUnread(B.id)).toBe(0);
    // "marcar todas" de A não toca nas de mais ninguém
    await createNotifications([{ userId: B.id, type: "agenda_lembrete", title: "[TesteL] nova para B" }]);
    expect(await markAllRead(A.id)).toBe(2);
    expect(await countUnread(A.id)).toBe(0);
    expect(await countUnread(B.id)).toBe(1);
    expect((await listNotifications(A.id, { unreadOnly: true })).length).toBe(0);
  });

  it("o link de uma notificação é sempre um caminho do painel", () => {
    expect(safeNotificationHref("/painel/agenda/12?dia=2034-03-06")).toBe("/painel/agenda/12?dia=2034-03-06");
    expect(safeNotificationHref("/painel")).toBe("/painel");
    for (const bad of ["https://exemplo.com", "//exemplo.com/painel", "/login", "javascript:alert(1)", "/painel/../x y", undefined]) expect(safeNotificationHref(bad), String(bad)).toBe("");
  });
});
