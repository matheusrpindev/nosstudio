/**
 * Agenda com banco de verdade (banco de teste):
 * - as consultas por janela EXPANDEM as séries, com exceções, "só este" e "este e os seguintes";
 * - PRIVACIDADE: nenhum campo de um compromisso particular chega a outro usuário por nenhuma consulta nem pelo
 *   aviso de conflito, e as actions não deixam mexer nele (teste com sentinelas);
 * - CONFLITOS: a action avisa e só grava quando a pessoa confirma.
 */
import { eq, inArray, like } from "drizzle-orm";
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

import { createEventAction, deleteEventAction, duplicateEventAction, rescheduleEventAction, setEventStatusAction, toggleChecklistItemAction, updateEventAction } from "@/app/painel/agenda/actions";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaEventPeople, agendaEvents, clients, projects } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import { fullAccess } from "./access";
import { findEventConflicts } from "./conflicts";
import type { EventInput } from "./input";
import { createEvent, deleteEventScoped, getMutableEvent, recordToInput, updateEventScoped } from "./mutations";
import { getEditableEvent, getEventView, listAgenda, type AgendaFilters } from "./queries";
import { loadEventRecord } from "./records";
import { ensurePersonalCalendars } from "./settings";

const S = "SENTINELA";
let A: TestAccount; // dona dos compromissos
let B: TestAccount; // outra pessoa do painel (administradora também)
let C: TestAccount; // participante
let categoryId = 0; // categoria e agenda neutras, usadas pelos compromissos comuns dos testes
let calendarId = 0;
let secretCategoryId = 0; // categoria e agenda "sentinela", só do compromisso particular
let secretCalendarId = 0;
let vacationCategoryId = 0;
let clientId = 0;
let projectId = 0;
const createdCategories: number[] = [];
const createdCalendars: number[] = [];

function input(over: Partial<EventInput>): EventInput {
  return {
    title: "[Teste] compromisso",
    categoryId,
    calendarId,
    description: "",
    date: "2031-03-03", // segunda-feira
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

const viewer = (account: TestAccount) => ({ id: account.id, role: account.role, permissions: account.permissions });
const record = async (id: number) => (await loadEventRecord(id))!;
/** Só os compromissos criados neste arquivo (o banco de teste é compartilhado com outros arquivos). */
const mine = (items: Awaited<ReturnType<typeof listAgenda>>, ids: number[]) => items.filter((item) => item.source === "event" && ids.includes(item.id));

beforeAll(async () => {
  A = await makeAccount("admin");
  B = await makeAccount("admin");
  C = await makeAccount("gestor");
  await ensurePersonalCalendars();
  const [category] = await db.insert(agendaCategories).values({ name: "[Teste] categoria", color: "rosa", icon: "heart" }).returning();
  const [secretCategory] = await db.insert(agendaCategories).values({ name: `${S}-categoria`, color: "rosa", icon: "heart" }).returning();
  const [vacation] = await db.insert(agendaCategories).values({ name: "[Teste] férias", color: "cinza", icon: "tree-palm", blocksDay: true }).returning();
  const [calendar] = await db.insert(agendaCalendars).values({ name: "[Teste] agenda", kind: "comercial", color: "azul" }).returning();
  const [secretCalendar] = await db.insert(agendaCalendars).values({ name: `${S}-agenda`, kind: "comercial", color: "azul" }).returning();
  const [client] = await db.insert(clients).values({ name: `${S}-cliente` }).returning();
  const [project] = await db.insert(projects).values({ title: `${S}-projeto`, clientId: client.id }).returning();
  categoryId = category.id;
  vacationCategoryId = vacation.id;
  calendarId = calendar.id;
  clientId = client.id;
  projectId = project.id;
  secretCategoryId = secretCategory.id;
  secretCalendarId = secretCalendar.id;
  createdCategories.push(category.id, vacation.id, secretCategory.id);
  createdCalendars.push(calendar.id, secretCalendar.id);
});

afterAll(async () => {
  await db.delete(agendaEvents).where(like(agendaEvents.title, "[Teste]%"));
  await db.delete(agendaEvents).where(like(agendaEvents.title, `${S}%`));
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(clients).where(eq(clients.id, clientId));
  await db.delete(agendaCategories).where(inArray(agendaCategories.id, createdCategories));
  await db.delete(agendaCalendars).where(inArray(agendaCalendars.id, createdCalendars));
  await removeAccounts();
});

describe("consultas por janela: expansão de séries", () => {
  it("série semanal aparece em cada segunda da janela, com chave e link por ocorrência", async () => {
    const { id } = await createEvent(input({ title: "[Teste] pauta semanal", recurrence: { freq: "semanal", interval: 1, weekdays: [1] } }), A.id);
    const items = mine(await listAgenda(viewer(A), "2031-03-01", "2031-03-31"), [id]);
    expect(items.map((item) => item.date)).toEqual(["2031-03-03", "2031-03-10", "2031-03-17", "2031-03-24", "2031-03-31"]);
    expect(items[1]).toMatchObject({ key: `e-${id}@2031-03-10`, href: `/painel/agenda/${id}?dia=2031-03-10`, recurring: true, startTime: "10:00", masked: false });
    // fora da janela nada; série que começa depois da janela não entra
    expect(mine(await listAgenda(viewer(A), "2031-02-01", "2031-02-28"), [id])).toEqual([]);
  });

  it("“só este” (excluir): a ocorrência some e as outras ficam", async () => {
    const { id } = await createEvent(input({ title: "[Teste] excluir só este", recurrence: { freq: "semanal", interval: 1, weekdays: [1] } }), A.id);
    await deleteEventScoped(await record(id), "este", "2031-03-10");
    const dates = mine(await listAgenda(viewer(A), "2031-03-01", "2031-03-31"), [id]).map((item) => item.date);
    expect(dates).toEqual(["2031-03-03", "2031-03-17", "2031-03-24", "2031-03-31"]);
    expect((await record(id)).recurrenceExceptions).toEqual(["2031-03-10"]);
  });

  it("“só este” (editar): a ocorrência vira um compromisso próprio, no novo dia/horário, e a série continua", async () => {
    const { id } = await createEvent(input({ title: "[Teste] editar só este", recurrence: { freq: "semanal", interval: 1, weekdays: [1] }, responsibleIds: [A.id] }), A.id);
    const series = await record(id);
    const saved = await updateEventScoped(series, { ...recordToInput(series, "2031-03-17"), title: "[Teste] editar só este (remarcado)", date: "2031-03-18", startTime: "15:00", endTime: "16:00" }, "este", "2031-03-17", A.id);
    expect(saved.id).not.toBe(id);
    const items = mine(await listAgenda(viewer(A), "2031-03-01", "2031-03-31"), [id, saved.id]);
    expect(items.map((item) => [item.date, item.startTime, item.title])).toEqual([
      ["2031-03-03", "10:00", "[Teste] editar só este"],
      ["2031-03-10", "10:00", "[Teste] editar só este"],
      ["2031-03-18", "15:00", "[Teste] editar só este (remarcado)"],
      ["2031-03-24", "10:00", "[Teste] editar só este"],
      ["2031-03-31", "10:00", "[Teste] editar só este"],
    ]);
    const child = await record(saved.id);
    expect(child).toMatchObject({ seriesId: id, originalDate: "2031-03-17", recurrence: null });
    expect(child.people.map((person) => person.userId)).toEqual([A.id]); // as pessoas acompanham a ocorrência
    // excluir a série leva junto a ocorrência separada
    await deleteEventScoped(await record(id), "todos", null);
    expect(await loadEventRecord(saved.id)).toBeNull();
  });

  it("“este e os seguintes” (editar): a série antiga termina na véspera e a nova segue com a mudança", async () => {
    const { id } = await createEvent(input({ title: "[Teste] seguintes", recurrence: { freq: "semanal", interval: 1, weekdays: [1], count: 6 } }), A.id);
    const series = await record(id);
    const saved = await updateEventScoped(series, { ...recordToInput(series, "2031-03-17"), title: "[Teste] seguintes (novo horário)", startTime: "14:00", endTime: "15:00" }, "seguintes", "2031-03-17", A.id);
    expect(saved.id).not.toBe(id);
    const items = mine(await listAgenda(viewer(A), "2031-03-01", "2031-05-31"), [id, saved.id]);
    expect(items.map((item) => [item.date, item.startTime])).toEqual([
      ["2031-03-03", "10:00"],
      ["2031-03-10", "10:00"],
      ["2031-03-17", "14:00"],
      ["2031-03-24", "14:00"],
      ["2031-03-31", "14:00"],
      ["2031-04-07", "14:00"], // 6 vezes no total: 2 antes + 4 depois
    ]);
    expect((await record(id)).recurrence).toMatchObject({ until: "2031-03-16" });
    expect((await record(saved.id)).recurrence).toMatchObject({ count: 4 });
  });

  it("“este e os seguintes” (excluir) e “todos” (editar: a série anda junto com o dia)", async () => {
    const { id } = await createEvent(input({ title: "[Teste] cortar", recurrence: { freq: "semanal", interval: 1, weekdays: [1] } }), A.id);
    await deleteEventScoped(await record(id), "seguintes", "2031-03-17");
    expect(mine(await listAgenda(viewer(A), "2031-03-01", "2031-04-30"), [id]).map((item) => item.date)).toEqual(["2031-03-03", "2031-03-10"]);

    const second = await createEvent(input({ title: "[Teste] mover todos", recurrence: { freq: "diaria", interval: 7 } }), A.id);
    const series = await record(second.id);
    // abriu a ocorrência de 10/03 e passou para 12/03 (quarta): todas andam dois dias
    await updateEventScoped(series, { ...recordToInput(series, "2031-03-10"), date: "2031-03-12" }, "todos", "2031-03-10", A.id);
    expect(mine(await listAgenda(viewer(A), "2031-03-01", "2031-03-31"), [second.id]).map((item) => item.date)).toEqual(["2031-03-05", "2031-03-12", "2031-03-19", "2031-03-26"]);
  });

  it("vários dias: o item traz o primeiro e o último dia e entra em janelas que só tocam o fim", async () => {
    const { id } = await createEvent(input({ title: "[Teste] viagem", date: "2031-05-30", endDate: "2031-06-02", startTime: null, endTime: null }), A.id);
    expect(mine(await listAgenda(viewer(A), "2031-06-01", "2031-06-30"), [id])).toMatchObject([{ date: "2031-05-30", endDate: "2031-06-02", startTime: null }]);
  });

  it("filtros: agenda, categoria, cliente, projeto, pessoa e busca por texto (sem acento)", async () => {
    const { id } = await createEvent(
      input({ title: "[Teste] Gravação no café", date: "2031-07-01", clientId, projectId, responsibleIds: [C.id], location: "Praça da Estação", externalPeople: ["Joana Fornecedora"] }),
      A.id,
    );
    const other = await createEvent(input({ title: "[Teste] outro assunto", date: "2031-07-01", categoryId: vacationCategoryId }), A.id);
    const list = async (filters: AgendaFilters) => mine(await listAgenda(viewer(A), "2031-07-01", "2031-07-01", filters), [id, other.id]).map((item) => item.id);
    expect(await list({})).toEqual([id, other.id].sort((x, y) => x - y));
    expect(await list({ categoryIds: [categoryId] })).toEqual([id]);
    expect(await list({ categoryIds: [] })).toEqual([]);
    expect(await list({ calendarIds: [calendarId] })).toHaveLength(2);
    expect(await list({ calendarIds: [] })).toEqual([]);
    expect(await list({ clientId })).toEqual([id]);
    expect(await list({ projectId })).toEqual([id]);
    expect(await list({ personId: C.id })).toEqual([id]);
    expect(await list({ personId: B.id })).toEqual([]);
    expect(await list({ q: "gravacao CAFE" })).toEqual([id]);
    expect(await list({ q: "estacao" })).toEqual([id]);
    expect(await list({ q: "joana" })).toEqual([id]);
    expect(await list({ q: "inexistente" })).toEqual([]);
  });
});

describe("privacidade: compromisso particular", () => {
  let secretId = 0;
  const window = ["2031-09-01", "2031-09-30"] as const;

  beforeAll(async () => {
    const created = await createEvent(
      input({
        title: `${S}-titulo`,
        categoryId: secretCategoryId,
        calendarId: secretCalendarId,
        description: `${S}-descricao`,
        date: "2031-09-10",
        startTime: "14:00",
        endTime: "15:00",
        location: `${S}-local`,
        mapUrl: `https://${S.toLowerCase()}.example/mapa`,
        meetingUrl: `https://${S.toLowerCase()}.example/reuniao`,
        clientId,
        projectId,
        visibility: "particular",
        notes: `${S}-observacoes`,
        checklist: [{ id: "c1", text: `${S}-checklist`, done: false }],
        reminders: [{ minutes: 15, channel: "email" }],
        participantIds: [C.id],
        externalPeople: [`${S}-externo`],
        production: {
          address: `${S}-endereco`,
          crewArrival: "13:00",
          script: `${S}-roteiro`,
          references: `${S}-referencias`,
          equipment: `${S}-equipamentos`,
          contentCount: 3,
          estimatedMinutes: 60,
          editDeadline: null,
          deliveryDate: null,
          prepChecklist: [{ id: "p1", text: `${S}-preparacao`, done: false }],
        },
      }),
      A.id,
    );
    secretId = created.id;
  });

  const leaks = (value: unknown) => {
    const json = JSON.stringify(value);
    return [S, S.toLowerCase(), C.name].filter((needle) => json.includes(needle));
  };

  it("a dona e a participante veem tudo", async () => {
    for (const account of [A, C]) {
      const [item] = mine(await listAgenda(viewer(account), ...window), [secretId]);
      expect(item).toMatchObject({ masked: false, title: `${S}-titulo`, clientName: `${S}-cliente` });
      expect((await getEventView(viewer(account), secretId, null, "2031-09-01"))?.event.masked).toBe(false);
      expect(await getEditableEvent(viewer(account), secretId)).not.toBeNull();
    }
  });

  it("outra pessoa (mesmo administradora) vê só “Ocupado” no horário, na lista", async () => {
    const items = mine(await listAgenda(viewer(B), ...window), [secretId]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ masked: true, title: "Ocupado", date: "2031-09-10", startTime: "14:00", endTime: "15:00", ownerName: A.name });
    expect(items[0]).toMatchObject({ location: "", clientName: null, people: [], label: "", categoryId: null, calendarId: null, icon: null, status: null, priority: null });
    expect(leaks(items)).toEqual([]);
  });

  it("nenhuma consulta entrega as sentinelas a quem não participa (lista com cada filtro, detalhe, edição, busca)", async () => {
    const everyFilter: AgendaFilters[] = [
      {},
      { layers: ["prazos", "editorial", "financeira"] },
      { calendarIds: [secretCalendarId] },
      { categoryIds: [secretCategoryId] },
      { clientId },
      { projectId },
      { personId: A.id },
      { personId: C.id },
      { q: S },
      { q: "titulo" },
      { q: "Ocupado" },
    ];
    for (const filters of everyFilter) {
      const all = await listAgenda(viewer(B), ...window, filters);
      // as camadas leem outros módulos (o projeto-sentinela pode aparecer como prazo): olhamos os compromissos
      expect(leaks(all.filter((item) => item.source === "event")), JSON.stringify(filters)).toEqual([]);
    }
    const view = await getEventView(viewer(B), secretId, null, "2031-09-01");
    expect(view?.event).toMatchObject({ masked: true, title: "Ocupado" });
    expect(leaks(view)).toEqual([]);
    expect(await getEditableEvent(viewer(B), secretId)).toBeNull();
    expect(await getMutableEvent(fullAccess(B.id), secretId)).toBeNull();
  });

  it("os filtros não servem de oráculo: com cliente, projeto, categoria ou texto, o “Ocupado” some", async () => {
    const shown = async (filters: AgendaFilters) => mine(await listAgenda(viewer(B), ...window, filters), [secretId]).length;
    expect(await shown({})).toBe(1);
    expect(await shown({ clientId })).toBe(0);
    expect(await shown({ projectId })).toBe(0);
    expect(await shown({ categoryIds: [secretCategoryId] })).toBe(0);
    expect(await shown({ q: "titulo" })).toBe(0);
    expect(await shown({ q: "ocupado" })).toBe(0);
    // por pessoa: só quando a pessoa é a própria dona (a participante não é revelada)
    expect(await shown({ personId: A.id })).toBe(1);
    expect(await shown({ personId: C.id })).toBe(0);
    // por agenda: conta como da agenda PESSOAL da dona, não da agenda em que está gravado
    const [personal] = await db.select({ id: agendaCalendars.id }).from(agendaCalendars).where(eq(agendaCalendars.userId, A.id));
    expect(await shown({ calendarIds: [secretCalendarId] })).toBe(0);
    expect(await shown({ calendarIds: [personal.id] })).toBe(1);
  });

  it("aviso de conflito: o particular de terceiros aparece como “Ocupado”, sem título", async () => {
    const candidate = { date: "2031-09-10", endDate: null, startTime: "14:30", endTime: "15:30", recurrence: null, status: "confirmado" as const, people: [A.id, C.id], blocksDay: false };
    const forB = await findEventConflicts(fullAccess(B.id), candidate);
    expect(forB.total).toBe(1);
    expect(forB.conflicts[0]).toMatchObject({ title: "Ocupado", date: "2031-09-10", startTime: "14:00", endTime: "15:00" });
    expect(JSON.stringify(forB)).not.toContain(S);
    // a dona, ao marcar outra coisa no mesmo horário, vê o próprio título
    expect((await findEventConflicts(fullAccess(A.id), candidate)).conflicts[0].title).toBe(`${S}-titulo`);
  });

  it("as actions não deixam quem não participa editar, reagendar, cancelar, duplicar, marcar checklist nem excluir", async () => {
    browser.token = B.token;
    const form = (fields: Record<string, string>) => {
      const data = new FormData();
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      return data;
    };
    const base = { id: String(secretId), scope: "este" };
    const edit = form({ ...base, title: "[Teste] invadido", categoryId: String(categoryId), calendarId: String(calendarId), date: "2031-09-11", startTime: "09:00" });
    const results = [
      await outcome(() => updateEventAction(initialActionState, edit)),
      await outcome(() => rescheduleEventAction(initialActionState, form({ ...base, date: "2031-09-12", startTime: "09:00" }))),
      await outcome(() => setEventStatusAction(initialActionState, form({ ...base, status: "cancelado" }))),
      await outcome(() => duplicateEventAction(initialActionState, form(base))),
      await outcome(() => toggleChecklistItemAction(initialActionState, form({ id: String(secretId), list: "checklist", itemId: "c1", done: "on" }))),
    ];
    for (const result of results) {
      expect(result).toMatchObject({ ok: false, message: "Este compromisso não existe mais." });
      expect(JSON.stringify(result)).not.toContain(S);
    }
    // excluir: responde como se já não existisse, e o compromisso continua lá
    expect(await outcome(() => deleteEventAction(initialActionState, form(base)))).toMatch(/^REDIRECT:\/painel\/agenda/);
    const after = await record(secretId);
    expect(after).toMatchObject({ title: `${S}-titulo`, date: "2031-09-10", status: "confirmado" });
    expect(after.checklist[0].done).toBe(false);
    browser.token = null;
  });

  it("particular cancelado deixa de aparecer como “Ocupado” para os outros", async () => {
    const { id } = await createEvent(input({ title: `${S}-cancelado`, date: "2031-09-20", visibility: "particular", status: "cancelado" }), A.id);
    expect(mine(await listAgenda(viewer(B), ...window), [id])).toEqual([]);
    expect(mine(await listAgenda(viewer(A), ...window), [id])).toHaveLength(1);
  });
});

describe("conflitos de horário", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const fields = (over: Record<string, string> = {}) => ({
    title: "[Teste] choque",
    categoryId: String(categoryId),
    calendarId: String(calendarId),
    date: "2031-11-05",
    startTime: "10:30",
    endTime: "11:30",
    responsibleIds: JSON.stringify([C.id]),
    ...over,
  });
  const count = async (title: string) => (await db.select({ id: agendaEvents.id }).from(agendaEvents).where(eq(agendaEvents.title, title))).length;

  it("a action avisa o choque e NÃO grava; com “salvar mesmo assim” grava", async () => {
    await createEvent(input({ title: "[Teste] já marcado", date: "2031-11-05", startTime: "10:00", endTime: "11:00", responsibleIds: [C.id] }), A.id);
    browser.token = A.token;
    const warned = (await outcome(() => createEventAction(initialActionState, form(fields())))) as ActionState<{ conflicts: { title: string; people: string[] }[]; total: number }>;
    expect(warned.ok).toBe(false);
    expect(warned.data?.total).toBe(1);
    expect(warned.data?.conflicts[0]).toMatchObject({ title: "[Teste] já marcado", date: "2031-11-05", startTime: "10:00", endTime: "11:00", people: [C.name] });
    expect(warned.values?.title).toBe("[Teste] choque"); // o que foi digitado volta para o formulário
    expect(await count("[Teste] choque")).toBe(0);

    expect(await outcome(() => createEventAction(initialActionState, form(fields({ ignoreConflicts: "1" }))))).toMatch(/^REDIRECT:\/painel\/agenda\?data=2031-11-05/);
    expect(await count("[Teste] choque")).toBe(1);
    browser.token = null;
  });

  it("sem pessoa em comum, encostando no horário ou com o outro cancelado: não há conflito", async () => {
    browser.token = A.token;
    // outra pessoa
    expect(await outcome(() => createEventAction(initialActionState, form(fields({ title: "[Teste] outra pessoa", responsibleIds: JSON.stringify([B.id]) }))))).toMatch(/^REDIRECT:/);
    // encosta (11:30 em diante; o "choque" gravado acima vai até 11:30)
    expect(await outcome(() => createEventAction(initialActionState, form(fields({ title: "[Teste] encosta", startTime: "11:30", endTime: "12:00" }))))).toMatch(/^REDIRECT:/);
    browser.token = null;
    const cancelled = await createEvent(input({ title: "[Teste] cancelado", date: "2031-11-06", startTime: "10:00", endTime: "11:00", responsibleIds: [C.id], status: "cancelado" }), A.id);
    expect(cancelled.id).toBeGreaterThan(0);
    const report = await findEventConflicts(fullAccess(A.id), { date: "2031-11-06", endDate: null, startTime: "10:00", endTime: "11:00", recurrence: null, status: "confirmado", people: [C.id], blocksDay: false });
    expect(report.total).toBe(0);
  });

  it("considera repetições (dos dois lados) e bloqueios de dia inteiro (férias)", async () => {
    // C tem aula toda quarta às 19:00; férias de 08 a 12/12
    await createEvent(input({ title: "[Teste] aula semanal", date: "2031-11-12", startTime: "19:00", endTime: "20:00", recurrence: { freq: "semanal", interval: 1 }, responsibleIds: [C.id] }), A.id);
    await createEvent(input({ title: "[Teste] férias da C", categoryId: vacationCategoryId, date: "2031-12-08", endDate: "2031-12-12", startTime: null, endTime: null, responsibleIds: [C.id] }), A.id);
    // candidato: toda quarta às 19:30, 5 vezes a partir de 19/11 → choca com a aula em cada quarta e com as férias em 10/12
    const report = await findEventConflicts(fullAccess(A.id), {
      date: "2031-11-19",
      endDate: null,
      startTime: "19:30",
      endTime: "20:30",
      recurrence: { freq: "semanal", interval: 1, count: 5 },
      status: "confirmado",
      people: [C.id],
      blocksDay: false,
    });
    expect(report.conflicts.map((conflict) => [conflict.date, conflict.title])).toEqual([
      ["2031-11-19", "[Teste] aula semanal"],
      ["2031-11-26", "[Teste] aula semanal"],
      ["2031-12-03", "[Teste] aula semanal"],
      ["2031-12-10", "[Teste] férias da C"],
      ["2031-12-10", "[Teste] aula semanal"],
      ["2031-12-17", "[Teste] aula semanal"],
    ]);
    expect(report.total).toBe(6);
    // dia inteiro comum (categoria que não bloqueia) não gera conflito
    await createEvent(input({ title: "[Teste] lembrete do dia", date: "2031-12-22", startTime: null, endTime: null, responsibleIds: [C.id] }), A.id);
    const calm = await findEventConflicts(fullAccess(A.id), { date: "2031-12-22", endDate: null, startTime: "09:00", endTime: "10:00", recurrence: null, status: "confirmado", people: [C.id], blocksDay: false });
    expect(calm.total).toBe(0);
  });

  it("ao editar, o próprio compromisso não choca consigo; reagendar para cima de outro avisa", async () => {
    const mineId = (await createEvent(input({ title: "[Teste] meu horário", date: "2032-01-07", startTime: "09:00", endTime: "10:00", responsibleIds: [C.id] }), A.id)).id;
    await createEvent(input({ title: "[Teste] vizinho", date: "2032-01-08", startTime: "09:00", endTime: "10:00", responsibleIds: [C.id] }), A.id);
    browser.token = A.token;
    // mesma data e hora: salva sem aviso (não conflita consigo)
    const same = form({ id: String(mineId), scope: "este", date: "2032-01-07", startTime: "09:15", endTime: "10:15" });
    expect(await outcome(() => rescheduleEventAction(initialActionState, same))).toBe(`REDIRECT:/painel/agenda/${mineId}`);
    // para cima do vizinho: avisa e não muda nada
    const clash = form({ id: String(mineId), scope: "este", date: "2032-01-08", startTime: "09:30", endTime: "10:30" });
    const warned = (await outcome(() => rescheduleEventAction(initialActionState, clash))) as ActionState<{ total: number }>;
    expect(warned.ok).toBe(false);
    expect(warned.data?.total).toBe(1);
    expect((await record(mineId)).date).toBe("2032-01-07");
    clash.set("ignoreConflicts", "1");
    expect(await outcome(() => rescheduleEventAction(initialActionState, clash))).toBe(`REDIRECT:/painel/agenda/${mineId}`);
    expect(await record(mineId)).toMatchObject({ date: "2032-01-08", startTime: "09:30", endTime: "10:30" });
    browser.token = null;
  });
});

describe("gravação", () => {
  it("criar pela action grava pessoas, categoria, resumo antigo (`kind`) e planejamento só em categoria de produção", async () => {
    const [production] = await db.insert(agendaCategories).values({ name: "[Teste] produção", color: "lima", icon: "video", isProduction: true }).returning();
    createdCategories.push(production.id);
    browser.token = A.token;
    const data = new FormData();
    const fields: Record<string, string> = {
      title: "[Teste] gravação completa",
      categoryId: String(production.id),
      calendarId: String(calendarId),
      date: "2032-02-02",
      startTime: "08:00",
      endTime: "12:00",
      mapUrl: "maps.app.goo.gl/abc",
      meetingUrl: "javascript:alert(1)",
      responsibleIds: JSON.stringify([A.id]),
      participantIds: JSON.stringify([A.id, C.id]),
      externalPeople: JSON.stringify(["Cliente no local", ""]),
      checklist: JSON.stringify([{ id: "x", text: "Levar tripé", done: false }, { id: "y", text: "  ", done: false }]),
      reminders: JSON.stringify([{ minutes: 60, channel: "interno" }, { minutes: 60, channel: "interno" }, { minutes: 15, channel: "email" }]),
      recurrence: JSON.stringify({ freq: "mensal", interval: 1, count: 3 }),
      prodAddress: "Rua de teste, 10",
      prodArrival: "07:30",
      prodEstimatedHours: "2,5",
      prodContentCount: "4",
    };
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    // link perigoso é recusado na validação
    const invalid = (await outcome(() => createEventAction(initialActionState, data))) as ActionState;
    expect(invalid.fieldErrors?.meetingUrl).toBeTruthy();
    data.set("meetingUrl", "https://meet.google.com/abc-defg-hij");
    data.set("ignoreConflicts", "1"); // a dona tem a "pauta semanal" dos testes acima no mesmo horário
    expect(await outcome(() => createEventAction(initialActionState, data))).toMatch(/^REDIRECT:\/painel\/agenda\?data=2032-02-02/);
    browser.token = null;

    const [row] = await db.select().from(agendaEvents).where(eq(agendaEvents.title, "[Teste] gravação completa"));
    expect(row).toMatchObject({
      kind: "outro",
      categoryId: production.id,
      ownerId: A.id,
      createdBy: A.id,
      mapUrl: "https://maps.app.goo.gl/abc",
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      recurrence: { freq: "mensal", interval: 1, count: 3 },
      checklist: [{ id: "x", text: "Levar tripé", done: false }],
      reminders: [
        { minutes: 15, channel: "email" },
        { minutes: 60, channel: "interno" },
      ],
    });
    expect(row.production).toMatchObject({ address: "Rua de teste, 10", crewArrival: "07:30", estimatedMinutes: 150, contentCount: 4 });
    const people = await db.select().from(agendaEventPeople).where(eq(agendaEventPeople.eventId, row.id)).orderBy(agendaEventPeople.sortOrder);
    expect(people.map((person) => [person.role, person.userId, person.externalName])).toEqual([
      ["responsavel", A.id, ""],
      ["participante", C.id, ""],
      ["externo", null, "Cliente no local"],
    ]);

    // mesma coisa numa categoria comum: o planejamento não é gravado
    browser.token = A.token;
    data.set("title", "[Teste] reunião com campos de gravação");
    data.set("categoryId", String(categoryId));
    data.set("ignoreConflicts", "1");
    await outcome(() => createEventAction(initialActionState, data));
    browser.token = null;
    const [plain] = await db.select().from(agendaEvents).where(eq(agendaEvents.title, "[Teste] reunião com campos de gravação"));
    expect(plain.production).toBeNull();
  });

  it("recusa agenda derivada (Financeira/Editorial), pessoa inativa e categoria inexistente", async () => {
    const [derived] = await db.select({ id: agendaCalendars.id }).from(agendaCalendars).where(eq(agendaCalendars.kind, "financeira"));
    browser.token = A.token;
    const attempt = async (over: Record<string, string>) => {
      const data = new FormData();
      const fields = { title: "[Teste] inválido", categoryId: String(categoryId), calendarId: String(calendarId), date: "2032-03-01", startTime: "09:00", ...over };
      for (const [key, value] of Object.entries(fields)) data.set(key, value);
      return (await outcome(() => createEventAction(initialActionState, data))) as ActionState;
    };
    expect((await attempt({ calendarId: String(derived.id) })).message).toMatch(/agenda/);
    expect((await attempt({ categoryId: "999999" })).message).toMatch(/categoria/);
    expect((await attempt({ responsibleIds: JSON.stringify([999999]) })).message).toMatch(/pessoas/);
    expect((await attempt({ startTime: "" })).fieldErrors?.startTime).toBeTruthy();
    expect((await attempt({ endTime: "08:00" })).fieldErrors?.endTime).toBeTruthy();
    expect((await attempt({ endDate: "2032-02-01" })).fieldErrors?.endDate).toBeTruthy();
    expect((await attempt({ recurrence: JSON.stringify({ freq: "semanal", interval: 1, until: "2031-01-01" }) })).fieldErrors?.recurrence).toBeTruthy();
    browser.token = null;
    expect(await db.select().from(agendaEvents).where(eq(agendaEvents.title, "[Teste] inválido"))).toEqual([]);
  });
});
