/**
 * Agenda — Parte 2, com banco de verdade:
 * - MOVER (arrastar/redimensionar) e DESFAZER, inclusive em séries ("só este", "este e os seguintes", "todos"),
 *   com o aviso de conflito e as recusas (cancelado, particular alheio, recibo adulterado/vencido);
 * - EXPORTAÇÃO .ics: privacidade ("Ocupado"), filtros, recorrência como RRULE/EXDATE e a rota com o guarda;
 * - DISPONIBILIDADE: ocupação por pessoa, bloqueios de dia inteiro e janelas livres em comum.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (browser.token && name.endsWith("nos_session") ? { name, value: browser.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new Error(`REDIRECT:${target}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidateTag: () => {}, updateTag: () => {}, cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/components/ui/flash", () => ({ flashToast: async () => {} }));

import { moveEventAction, undoMoveEventAction, type MoveActionData } from "@/app/painel/agenda/actions";
import { GET as exportRoute } from "@/app/painel/agenda/exportar/route";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaEvents, clients, projectMembers, projects } from "@/db/schema";
import { buildCalendar } from "@/lib/agenda/ics";
import { events as icsEvents, parseIcs, prop, props } from "@/lib/agenda/ics-reader";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import { agendaAccess, fullAccess } from "./access";
import { createBlock, getAvailability } from "./availability";
import { listIcsEvents } from "./export";
import type { EventInput } from "./input";
import { moveEvent, moveInput, undoMove, UNDO_TTL_MS } from "./move";
import { createEvent, recordToInput, updateEventScoped } from "./mutations";
import { listAgenda } from "./queries";
import { loadEventRecord } from "./records";
import { ensurePersonalCalendars } from "./settings";

const S = "SENTINELA-P2";
let A: TestAccount;
let B: TestAccount;
let C: TestAccount;
let categoryId = 0;
let blockCategoryId = 0;
let calendarId = 0;
let clientId = 0;
let projectId = 0;

function input(over: Partial<EventInput>): EventInput {
  return {
    title: "[TesteP2] compromisso",
    categoryId,
    calendarId,
    description: "",
    date: "2035-03-05", // segunda-feira
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
const record = async (id: number) => (await loadEventRecord(id))!;
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const datesOf = async (ids: number[], from: string, to: string) =>
  (await listAgenda(A, from, to))
    .filter((item) => item.source === "event" && ids.includes(item.id))
    .map((item) => `${item.date} ${item.startTime}`);

beforeAll(async () => {
  A = await makeAccount("admin");
  B = await makeAccount("admin");
  C = await makeAccount("gestor");
  await ensurePersonalCalendars();
  const [category] = await db.insert(agendaCategories).values({ name: "[TesteP2] categoria", color: "rosa", icon: "heart" }).returning();
  const [block] = await db.insert(agendaCategories).values({ name: "[TesteP2] bloqueio", slug: `testep2-bloqueio-${Date.now()}`, color: "cinza", icon: "tree-palm", blocksDay: true }).returning();
  const [calendar] = await db.insert(agendaCalendars).values({ name: "[TesteP2] agenda", kind: "comercial", color: "azul" }).returning();
  const [client] = await db.insert(clients).values({ name: "[TesteP2] cliente" }).returning();
  const [project] = await db.insert(projects).values({ title: "[TesteP2] projeto", clientId: client.id }).returning();
  categoryId = category.id;
  blockCategoryId = block.id;
  calendarId = calendar.id;
  clientId = client.id;
  projectId = project.id;
});

afterAll(async () => {
  browser.token = null;
  const mine = await db.select({ id: agendaEvents.id }).from(agendaEvents).where(inArray(agendaEvents.createdBy, [A.id, B.id, C.id]));
  if (mine.length) await db.delete(agendaEvents).where(inArray(agendaEvents.id, mine.map((row) => row.id)));
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(clients).where(eq(clients.id, clientId));
  await db.delete(agendaCategories).where(inArray(agendaCategories.id, [categoryId, blockCategoryId]));
  await db.delete(agendaCalendars).where(eq(agendaCalendars.id, calendarId));
  await removeAccounts();
});

// =========================================================================== mover e desfazer
describe("mover (arrastar e redimensionar) e desfazer", () => {
  it("compromisso avulso: muda dia e horário mantendo o resto; desfazer devolve como estava", async () => {
    const { id } = await createEvent(input({ title: "[TesteP2] mover", description: "pauta", responsibleIds: [A.id], participantIds: [C.id], checklist: [{ id: "a", text: "x", done: true }] }), A.id);
    const before = await record(id);
    const moved = moveInput(before, null, { date: "2035-03-07", startTime: "14:15", endTime: "15:15" });
    if (moved.error !== null) throw new Error(moved.error);
    const { saved, undo } = await moveEvent(before, moved.input, "este", null, A.id);
    expect(saved).toEqual({ id, date: "2035-03-07" });
    expect(await record(id)).toMatchObject({ date: "2035-03-07", startTime: "14:15", endTime: "15:15", description: "pauta", checklist: [{ id: "a", text: "x", done: true }] });
    expect((await record(id)).people.map((person) => person.userId).sort()).toEqual([A.id, C.id].sort());

    expect(await undoMove(fullAccess(A.id), undo)).toEqual({ ok: true, id, date: "2035-03-05" });
    expect(await record(id)).toMatchObject({ date: "2035-03-05", startTime: "10:00", endTime: "11:00" });
    // o recibo vale uma vez: depois de desfeito, o compromisso "mudou"
    expect(await undoMove(fullAccess(A.id), undo)).toEqual({ ok: false, reason: "mudou" });
  });

  it("regras do novo horário: dia inteiro continua dia inteiro; sem fim continua sem; fim depois do início; vários dias andam juntos", async () => {
    const allDay = await record((await createEvent(input({ title: "[TesteP2] dia inteiro", startTime: null, endTime: null, endDate: "2035-03-07" }), A.id)).id);
    const a = moveInput(allDay, null, { date: "2035-03-10", startTime: "09:00", endTime: "10:00" });
    expect(a.error === null && a.input).toMatchObject({ date: "2035-03-10", endDate: "2035-03-12", startTime: null, endTime: null });

    const open = await record((await createEvent(input({ title: "[TesteP2] sem fim", endTime: null }), A.id)).id);
    const b = moveInput(open, null, { date: "2035-03-06", startTime: "08:30", endTime: "12:00" });
    expect(b.error === null && b.input).toMatchObject({ date: "2035-03-06", startTime: "08:30", endTime: null });

    const timed = await record((await createEvent(input({ title: "[TesteP2] com hora" }), A.id)).id);
    expect(moveInput(timed, null, { date: "2035-03-06", startTime: "11:00", endTime: "11:00" })).toEqual({ error: "O fim precisa ser depois do início." });
    expect(moveInput(timed, null, { date: "2035-03-06", startTime: null, endTime: null })).toEqual({ error: "Horário inválido." });
    expect(moveInput(timed, null, { date: "2035-02-30", startTime: "11:00", endTime: "12:00" })).toEqual({ error: "Data inválida." });

    const night = await record((await createEvent(input({ title: "[TesteP2] vira a noite", endDate: "2035-03-06", startTime: "22:00", endTime: "02:00" }), A.id)).id);
    const stillNight = moveInput(night, null, { date: "2035-03-08", startTime: "21:00", endTime: "01:00" });
    expect(stillNight.error === null && stillNight.input).toMatchObject({ date: "2035-03-08", endDate: "2035-03-09", startTime: "21:00", endTime: "01:00" });
    const sameDay = moveInput(night, null, { date: "2035-03-08", startTime: "18:00", endTime: "22:00" });
    expect(sameDay.error === null && sameDay.input).toMatchObject({ date: "2035-03-08", endDate: null, startTime: "18:00", endTime: "22:00" });
  });

  it("série, “só este”: a ocorrência se separa; desfazer devolve a série inteira e apaga a avulsa", async () => {
    const { id } = await createEvent(input({ title: "[TesteP2] série este", recurrence: { freq: "semanal", interval: 1, count: 4 }, responsibleIds: [A.id] }), A.id);
    const series = await record(id);
    const moved = moveInput(series, "2035-03-12", { date: "2035-03-13", startTime: "16:00", endTime: "17:00" });
    if (moved.error !== null) throw new Error(moved.error);
    const { saved, undo } = await moveEvent(series, moved.input, "este", "2035-03-12", A.id);
    expect(saved.id).not.toBe(id);
    expect(await datesOf([id, saved.id], "2035-03-01", "2035-03-31")).toEqual(["2035-03-05 10:00", "2035-03-13 16:00", "2035-03-19 10:00", "2035-03-26 10:00"]);
    expect((await record(id)).recurrenceExceptions).toEqual(["2035-03-12"]);

    expect(await undoMove(fullAccess(A.id), undo)).toMatchObject({ ok: true, id });
    expect(await loadEventRecord(saved.id)).toBeNull();
    expect((await record(id)).recurrenceExceptions).toEqual([]);
    expect(await datesOf([id, saved.id], "2035-03-01", "2035-03-31")).toEqual(["2035-03-05 10:00", "2035-03-12 10:00", "2035-03-19 10:00", "2035-03-26 10:00"]);
  });

  it("série, “este e os seguintes”: nasce outra série; desfazer junta as duas de volta (com as ocorrências já separadas)", async () => {
    const { id } = await createEvent(input({ title: "[TesteP2] série seguintes", date: "2035-05-07", recurrence: { freq: "semanal", interval: 1, count: 5 }, responsibleIds: [A.id] }), A.id);
    // a 4ª ocorrência (28/05) já tinha sido editada sozinha
    const detached = await updateEventScoped(await record(id), { ...recordToInput(await record(id), "2035-05-28"), startTime: "18:00", endTime: "19:00" }, "este", "2035-05-28", A.id);
    const series = await record(id);
    const moved = moveInput(series, "2035-05-21", { date: "2035-05-22", startTime: "09:00", endTime: "10:00" });
    if (moved.error !== null) throw new Error(moved.error);
    const { saved, undo } = await moveEvent(series, moved.input, "seguintes", "2035-05-21", A.id);
    expect(saved.id).not.toBe(id);
    const all = [id, saved.id, detached.id];
    expect(await datesOf(all, "2035-05-01", "2035-06-30")).toEqual(["2035-05-07 10:00", "2035-05-14 10:00", "2035-05-22 09:00", "2035-05-28 18:00", "2035-06-05 09:00"]);
    expect((await record(detached.id)).seriesId).toBe(saved.id);

    expect(await undoMove(fullAccess(A.id), undo)).toMatchObject({ ok: true, id });
    expect(await loadEventRecord(saved.id)).toBeNull();
    expect((await record(detached.id)).seriesId).toBe(id);
    expect(await datesOf(all, "2035-05-01", "2035-06-30")).toEqual(["2035-05-07 10:00", "2035-05-14 10:00", "2035-05-21 10:00", "2035-05-28 18:00", "2035-06-04 10:00"]);
  });

  it("série, “todos”: a série inteira anda junto; desfazer volta", async () => {
    const { id } = await createEvent(input({ title: "[TesteP2] série todos", date: "2035-07-02", recurrence: { freq: "semanal", interval: 1, count: 3 }, responsibleIds: [A.id] }), A.id);
    const series = await record(id);
    const moved = moveInput(series, "2035-07-09", { date: "2035-07-11", startTime: "10:30", endTime: "11:30" });
    if (moved.error !== null) throw new Error(moved.error);
    const { saved, undo } = await moveEvent(series, moved.input, "todos", "2035-07-09", A.id);
    expect(saved.id).toBe(id);
    expect(await datesOf([id], "2035-07-01", "2035-07-31")).toEqual(["2035-07-04 10:30", "2035-07-11 10:30", "2035-07-18 10:30"]);
    expect(await undoMove(fullAccess(A.id), undo)).toMatchObject({ ok: true });
    expect(await datesOf([id], "2035-07-01", "2035-07-31")).toEqual(["2035-07-02 10:00", "2035-07-09 10:00", "2035-07-16 10:00"]);
  });

  it("desfazer é recusado: recibo de outra pessoa, adulterado, vencido, ou compromisso alterado depois", async () => {
    const { id } = await createEvent(input({ title: "[TesteP2] recibo", responsibleIds: [A.id] }), A.id);
    const before = await record(id);
    const moved = moveInput(before, null, { date: "2035-03-09", startTime: "10:00", endTime: "11:00" });
    if (moved.error !== null) throw new Error(moved.error);
    const now = new Date();
    const { undo } = await moveEvent(before, moved.input, "este", null, A.id, now);

    expect(await undoMove(fullAccess(B.id), undo)).toEqual({ ok: false, reason: "invalido" });
    const [body, signature] = undo.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString("utf8")), b: { date: "2030-01-01", endDate: null, startTime: "01:00", endTime: "02:00", recurrence: null, exceptions: [] } })).toString("base64url");
    expect(await undoMove(fullAccess(A.id), `${forged}.${signature}`)).toEqual({ ok: false, reason: "invalido" });
    expect(await undoMove(fullAccess(A.id), "lixo")).toEqual({ ok: false, reason: "invalido" });
    expect(await undoMove(fullAccess(A.id), undo, new Date(now.getTime() + UNDO_TTL_MS + 1000))).toEqual({ ok: false, reason: "expirado" });
    expect((await record(id)).date).toBe("2035-03-09");
    // alguém editou depois: desfazer apagaria a edição
    await db.update(agendaEvents).set({ title: "[TesteP2] recibo (editado)", updatedAt: new Date(now.getTime() + 5000) }).where(eq(agendaEvents.id, id));
    expect(await undoMove(fullAccess(A.id), undo)).toEqual({ ok: false, reason: "mudou" });
    expect(await record(id)).toMatchObject({ date: "2035-03-09", title: "[TesteP2] recibo (editado)" });
  });

  it("action: conflito avisa e não grava; confirmando, grava e devolve o recibo; desfazer pela action", async () => {
    const mine = (await createEvent(input({ title: "[TesteP2] arrastado", date: "2035-08-06", responsibleIds: [C.id] }), A.id)).id;
    await createEvent(input({ title: "[TesteP2] vizinho", date: "2035-08-07", startTime: "09:00", endTime: "10:00", responsibleIds: [C.id] }), A.id);
    browser.token = A.token;
    const drop = form({ id: String(mine), scope: "este", date: "2035-08-07", startTime: "09:30", endTime: "10:30" });
    const warned = (await moveEventAction(initialActionState, drop)) as ActionState<MoveActionData>;
    expect(warned.ok).toBe(false);
    expect(warned.data?.total).toBe(1);
    expect(warned.data?.conflicts?.[0]).toMatchObject({ title: "[TesteP2] vizinho", date: "2035-08-07", startTime: "09:00" });
    expect(warned.data?.undo).toBeUndefined();
    expect((await record(mine)).date).toBe("2035-08-06");

    drop.set("ignoreConflicts", "1");
    const done = (await moveEventAction(initialActionState, drop)) as ActionState<MoveActionData>;
    expect(done).toMatchObject({ ok: true, message: "Compromisso movido." });
    expect(await record(mine)).toMatchObject({ date: "2035-08-07", startTime: "09:30", endTime: "10:30" });

    expect(await undoMoveEventAction(initialActionState, form({ undo: done.data?.undo ?? "" }))).toMatchObject({ ok: true, message: "Movimento desfeito." });
    expect(await record(mine)).toMatchObject({ date: "2035-08-06", startTime: "10:00", endTime: "11:00" });
    expect(await undoMoveEventAction(initialActionState, form({ undo: "x".repeat(40) }))).toMatchObject({ ok: false });
    browser.token = null;
  });

  it("action: cancelado não move; particular de outra pessoa é como se não existisse", async () => {
    const cancelled = (await createEvent(input({ title: "[TesteP2] cancelado", date: "2035-08-20", status: "cancelado", responsibleIds: [A.id] }), A.id)).id;
    const secret = (await createEvent(input({ title: `${S}-particular`, date: "2035-08-21", visibility: "particular", responsibleIds: [A.id] }), A.id)).id;
    browser.token = A.token;
    expect(await moveEventAction(initialActionState, form({ id: String(cancelled), scope: "este", date: "2035-08-22", startTime: "10:00", endTime: "11:00" }))).toMatchObject({ ok: false, message: expect.stringContaining("cancelado") });
    browser.token = B.token; // admin também: para ela, o particular da A é só "Ocupado"
    const result = (await outcome(() => moveEventAction(initialActionState, form({ id: String(secret), scope: "este", date: "2035-08-22", startTime: "10:00", endTime: "11:00" })))) as ActionState<MoveActionData>;
    expect(result).toMatchObject({ ok: false, message: "Este compromisso não existe mais." });
    expect(JSON.stringify(result)).not.toContain(S);
    expect((await record(secret)).date).toBe("2035-08-21");
    expect((await record(cancelled)).date).toBe("2035-08-20");
    browser.token = null;
  });

  it("os itens da lista dizem o que pode ser arrastado: mascarado nunca; série carrega a data da 1ª ocorrência", async () => {
    const series = (await createEvent(input({ title: "[TesteP2] série na lista", date: "2035-09-03", recurrence: { freq: "semanal", interval: 1, count: 2 }, responsibleIds: [A.id] }), A.id)).id;
    const secret = (await createEvent(input({ title: `${S}-na-lista`, date: "2035-09-04", visibility: "particular", responsibleIds: [A.id] }), A.id)).id;
    const forB = (await listAgenda(B, "2035-09-01", "2035-09-30")).filter((item) => [series, secret].includes(item.id));
    expect(forB.find((item) => item.id === secret)).toMatchObject({ masked: true, editable: false, seriesStart: null, projectId: null, title: "Ocupado" });
    expect(forB.filter((item) => item.id === series).map((item) => [item.date, item.seriesStart, item.editable])).toEqual([
      ["2035-09-03", "2035-09-03", true],
      ["2035-09-10", "2035-09-03", true],
    ]);
  });
});

// =========================================================================== exportação .ics
describe("exportação .ics", () => {
  const FROM = "2036-02-01";
  const TO = "2036-02-29";
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    const make = async (key: string, over: Partial<EventInput>) => (ids[key] = (await createEvent(input({ title: `[TesteP2] ${key}`, ...over }), A.id)).id);
    await make("normal", { date: "2036-02-04", location: "Rua A, 10", description: "Linha 1\nLinha 2", clientId, projectId, responsibleIds: [A.id], participantIds: [C.id], reminders: [{ minutes: 30, channel: "interno" }] });
    await make("particular", { title: `${S}-titulo`, description: `${S}-descricao`, location: `${S}-local`, date: "2036-02-05", startTime: "14:00", endTime: "15:00", visibility: "particular", clientId, responsibleIds: [A.id], reminders: [{ minutes: 10, channel: "interno" }] });
    await make("serie", { date: "2036-02-06", startTime: "09:00", endTime: "09:30", recurrence: { freq: "semanal", interval: 1, count: 6 }, responsibleIds: [A.id] });
    await updateEventScoped(await record(ids.serie), recordToInput(await record(ids.serie), "2036-02-13"), "este", "2036-02-13", A.id); // 13/02 vira avulso
    await make("dia-inteiro", { date: "2036-02-10", endDate: "2036-02-12", startTime: null, endTime: null });
    await make("cancelado", { date: "2036-02-18", status: "cancelado" });
    await make("fora-do-periodo", { date: "2036-04-01" });
    await make("serie-antiga", { date: "2035-11-01", recurrence: { freq: "diaria", interval: 1, count: 3 } }); // acabou antes do período
  });

  const byId = (events: Awaited<ReturnType<typeof listIcsEvents>>, key: string) => events.find((event) => event.uid.startsWith(`agenda-${ids[key]}@`));

  it("quem participa recebe tudo; para outra pessoa, o particular é só “Ocupado” no horário", async () => {
    const mine = await listIcsEvents(await agendaAccess(A), FROM, TO);
    expect(byId(mine, "particular")).toMatchObject({ title: `${S}-titulo`, private: true, location: `${S}-local` });
    expect(byId(mine, "normal")).toMatchObject({ title: "[TesteP2] normal", location: "Rua A, 10", private: false, alarms: [30], status: "CONFIRMED" });
    expect(byId(mine, "normal")?.description).toContain("Cliente: [TesteP2] cliente");
    expect(byId(mine, "cancelado")).toMatchObject({ status: "CANCELLED" });
    // fora do período pedido: nem o avulso de abril, nem a série que já tinha acabado
    expect(byId(mine, "fora-do-periodo")).toBeUndefined();
    expect(byId(mine, "serie-antiga")).toBeUndefined();

    const others = await listIcsEvents(await agendaAccess(B), FROM, TO);
    const masked = byId(others, "particular");
    expect(masked).toEqual({ uid: masked?.uid, title: "Ocupado", date: "2036-02-05", endDate: "2036-02-05", startTime: "14:00", endTime: "15:00", recurrence: null, exceptions: [], status: "CONFIRMED", private: true });
    expect(JSON.stringify(others.filter((event) => !event.uid.startsWith(`agenda-${ids.normal}@`)))).not.toContain(S);
    expect(JSON.stringify(others)).not.toContain(`${S}-`);
  });

  it("filtros: com filtro de conteúdo (cliente, projeto, categoria) o “Ocupado” some — o filtro não revela o que ele é", async () => {
    const access = await agendaAccess(B);
    const byClient = await listIcsEvents(access, FROM, TO, { clientId });
    expect(byClient.map((event) => event.title)).toEqual(["[TesteP2] normal"]);
    expect((await listIcsEvents(access, FROM, TO, { projectId })).map((event) => event.title)).toEqual(["[TesteP2] normal"]);
    expect((await listIcsEvents(access, FROM, TO, { categoryIds: [categoryId] })).some((event) => event.title === "Ocupado")).toBe(false);
    expect((await listIcsEvents(access, FROM, TO, { personId: C.id })).map((event) => event.title)).toEqual(["[TesteP2] normal"]);
    expect(await listIcsEvents(access, FROM, TO, { calendarIds: [] })).toEqual([]);
    // sem alcance: nada
    expect(await listIcsEvents(await agendaAccess(await makeAccount("freelancer")), FROM, TO)).toEqual([]);
  });

  it("a série sai como UM evento com RRULE e EXDATE; a ocorrência separada sai como evento próprio", async () => {
    const text = buildCalendar(await listIcsEvents(await agendaAccess(A), FROM, TO), { name: "Agenda", now: new Date("2036-01-15T12:00:00Z") });
    const calendar = parseIcs(text);
    const list = icsEvents(calendar);
    const series = list.filter((event) => prop(event, "UID")?.value.startsWith(`agenda-${ids.serie}@`));
    expect(series).toHaveLength(1);
    expect(prop(series[0], "DTSTART")).toMatchObject({ params: { TZID: "America/Sao_Paulo" }, value: "20360206T090000" });
    expect(prop(series[0], "RRULE")?.value).toBe("FREQ=WEEKLY;BYDAY=WE;WKST=SU;COUNT=6");
    expect(props(series[0], "EXDATE").map((item) => item.value)).toEqual(["20360213T090000"]);
    const detached = list.filter((event) => prop(event, "SUMMARY")?.value === "[TesteP2] serie" && !prop(event, "RRULE"));
    expect(detached.map((event) => prop(event, "DTSTART")?.value)).toEqual(["20360213T090000"]);
    // dia inteiro de três dias: fim exclusivo
    const allDay = list.find((event) => prop(event, "UID")?.value.startsWith(`agenda-${ids["dia-inteiro"]}@`))!;
    expect([prop(allDay, "DTSTART")?.value, prop(allDay, "DTEND")?.value]).toEqual(["20360210", "20360213"]);
    // todos os eventos com os campos obrigatórios e identificadores únicos
    for (const event of list) for (const name of ["UID", "DTSTAMP", "DTSTART", "SUMMARY"]) expect(prop(event, name), name).toBeDefined();
    expect(new Set(list.map((event) => prop(event, "UID")?.value)).size).toBe(list.length);
  });

  it("rota: exige sessão e `agenda:baixar`; entrega text/calendar para baixar, com o particular alheio mascarado", async () => {
    const url = `http://localhost/painel/agenda/exportar?de=${FROM}&ate=${TO}`;
    browser.token = null;
    expect((await exportRoute(new Request(url))).status).toBe(401);
    browser.token = (await makeAccount("freelancer")).token;
    expect((await exportRoute(new Request(url))).status).toBe(403);
    browser.token = (await makeAccount("admin", { mustChangePassword: true })).token;
    expect((await exportRoute(new Request(url))).status).toBe(403);

    browser.token = B.token;
    const response = await exportRoute(new Request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="agenda-nos-${FROM}_${TO}.ics"`);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const text = await response.text();
    expect(text).not.toContain(S);
    const mine = icsEvents(parseIcs(text)).filter((event) => Object.values(ids).some((id) => prop(event, "UID")?.value.startsWith(`agenda-${id}@`)));
    expect(mine.filter((event) => prop(event, "SUMMARY")?.value === "Ocupado")).toHaveLength(1);
    // o filtro da URL vale na rota também
    const filtered = await (await exportRoute(new Request(`${url}&cliente=${clientId}`))).text();
    expect(icsEvents(parseIcs(filtered)).map((event) => prop(event, "SUMMARY")?.value)).toEqual(["[TesteP2] normal"]);

    // funcionário: baixa só o que alcança (aqui, o compromisso do projeto em que é membro)
    const worker = await makeAccount("funcionario");
    await db.insert(projectMembers).values({ projectId, userId: worker.id, canView: true, canDownload: true });
    browser.token = worker.token;
    const own = await exportRoute(new Request(url));
    expect(own.status).toBe(200);
    expect(icsEvents(parseIcs(await own.text())).map((event) => prop(event, "SUMMARY")?.value)).toEqual(["[TesteP2] normal"]);
    browser.token = null;
  });
});

// =========================================================================== disponibilidade
describe("disponibilidade da equipe", () => {
  const DAY = "2036-06-10";

  it("ocupação por pessoa, particular como “Ocupado”, cancelado fora, e as janelas livres em comum", async () => {
    await createEvent(input({ title: "[TesteP2] manhã da A", date: DAY, startTime: "09:00", endTime: "10:30", responsibleIds: [A.id] }), A.id);
    await createEvent(input({ title: "[TesteP2] tarde da C", date: DAY, startTime: "14:00", endTime: "16:00", responsibleIds: [C.id], status: "a_confirmar" }), A.id);
    await createEvent(input({ title: `${S}-consulta`, date: DAY, startTime: "17:00", endTime: "18:00", visibility: "particular", responsibleIds: [C.id] }), C.id);
    await createEvent(input({ title: "[TesteP2] cancelado da A", date: DAY, startTime: "11:00", endTime: "12:00", status: "cancelado", responsibleIds: [A.id] }), A.id);
    await createEvent(input({ title: "[TesteP2] lembrete do dia", date: DAY, startTime: null, endTime: null, responsibleIds: [A.id] }), A.id);

    const result = (await getAvailability(A, [DAY], [A.id, C.id]))!;
    expect(result.people.map((person) => person.id).sort()).toEqual([A.id, C.id].sort());
    const day = result.days[0];
    expect(day.people[A.id].busy.map((block) => [block.title, block.startTime, block.endTime])).toEqual([["[TesteP2] manhã da A", "09:00", "10:30"]]);
    expect(day.people[A.id].notes.map((block) => block.title)).toEqual(["[TesteP2] lembrete do dia"]);
    expect(day.people[C.id].busy.map((block) => [block.title, block.startTime, block.masked, block.tentative])).toEqual([
      ["[TesteP2] tarde da C", "14:00", false, true],
      ["Ocupado", "17:00", true, false],
    ]);
    expect(JSON.stringify(result)).not.toContain(S);
    expect(day.free).toEqual([
      { start: "08:00", end: "09:00" },
      { start: "10:30", end: "14:00" },
      { start: "16:00", end: "17:00" },
      { start: "18:00", end: "20:00" },
    ]);
    // só a A: os compromissos da C não tiram janela
    expect((await getAvailability(A, [DAY], [A.id]))!.days[0].free).toEqual([
      { start: "08:00", end: "09:00" },
      { start: "10:30", end: "20:00" },
    ]);
    // ninguém selecionado: sem janelas; quem não tem a agenda inteira: sem consulta
    expect((await getAvailability(A, [DAY], []))!.days[0].free).toEqual([]);
    expect(await getAvailability(await makeAccount("funcionario"), [DAY], [A.id])).toBeNull();
  });

  it("“bloquear período”: dia inteiro com data final, categoria que bloqueia — a pessoa fica sem janela nesses dias", async () => {
    const created = await createBlock({ personId: C.id, date: "2036-07-01", endDate: "2036-07-03", title: "", createdBy: A.id });
    if ("error" in created) throw new Error(created.error);
    const block = await record(created.id);
    expect(block).toMatchObject({ title: "Indisponível", date: "2036-07-01", endDate: "2036-07-03", startTime: null, categoryBlocksDay: true, calendarKind: "pessoal" });
    expect(block.people.map((person) => [person.userId, person.role])).toEqual([[C.id, "responsavel"]]);

    const result = (await getAvailability(A, ["2036-07-01", "2036-07-02", "2036-07-03", "2036-07-04"], [A.id, C.id]))!;
    expect(result.days.map((day) => day.free.length)).toEqual([0, 0, 0, 1]);
    expect(result.days[1].people[C.id].busy).toMatchObject([{ title: "Indisponível", wholeDay: true }]);
    expect(await createBlock({ personId: 999_999, date: "2036-07-01", endDate: "2036-07-03", title: "", createdBy: A.id })).toHaveProperty("error");
  });
});
