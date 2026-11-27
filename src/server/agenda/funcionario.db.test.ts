/**
 * FUNCIONÁRIO NA AGENDA (alcance "só nos projetos em que está") — isolamento com banco de verdade:
 * - vê os compromissos em que é responsável/participante (ou que criou) e os dos projetos em que é membro;
 * - NÃO vê compromisso de projeto alheio, nem sem projeto de que não participa, nem particular alheio (nem como
 *   "Ocupado") — por nenhuma consulta: lista, detalhe, exportação .ics, aviso de conflito, disponibilidade;
 * - altera só os próprios (criou ou é responsável); não exclui; ao criar, só liga a projeto em que pode editar,
 *   e o cliente vem do projeto.
 */
import { and, eq, inArray } from "drizzle-orm";
import { isValidElement } from "react";
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

import {
  blockPeriodAction,
  createEventAction,
  deleteEventAction,
  duplicateEventAction,
  moveEventAction,
  rescheduleEventAction,
  setEventStatusAction,
  toggleChecklistItemAction,
  updateEventAction,
} from "@/app/painel/agenda/actions";
import { db } from "@/db";
import { agendaCalendars, agendaCategories, agendaEventPeople, agendaEvents, clients, projectMembers, projects } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { canUsePanelModule, PROJECT_SCOPED_PANEL_MODULES } from "@/lib/permissions";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import { agendaAccess } from "./access";
import { getAvailability } from "./availability";
import { findEventConflicts } from "./conflicts";
import { listIcsEvents } from "./export";
import type { EventInput } from "./input";
import { createEvent } from "./mutations";
import { getEditableEvent, getEventView, listAgenda } from "./queries";
import { loadEventRecord } from "./records";
import { ensurePersonalCalendars } from "./settings";
import { getProjectTimeline } from "./timeline";

const S = "SENTINELA-F";
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";
const GONE = "Este compromisso não existe mais.";
const FROM = "2033-05-01";
const TO = "2033-05-31";

let ADMIN: TestAccount;
let F: TestAccount; // o funcionário
let OUTRO: TestAccount; // outro funcionário, sem vínculo nenhum
let categoryId = 0;
let blockCategoryId = 0;
let calendarId = 0;
let clientId = 0;
let MEU = 0; // projeto em que F é membro com "editar"
let SO_VER = 0; // projeto em que F é membro só com "ver"
let ALHEIO = 0; // projeto em que F não está
const ids: Record<string, number> = {};
const createdEvents: number[] = [];

function input(over: Partial<EventInput>): EventInput {
  return {
    title: "[TesteF] compromisso",
    categoryId,
    calendarId,
    description: "",
    date: "2033-05-10",
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

async function make(key: string, over: Partial<EventInput>, creator: TestAccount) {
  const event = await createEvent(input({ title: `[TesteF] ${key}`, ...over }), creator.id);
  ids[key] = event.id;
  createdEvents.push(event.id);
  return event.id;
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const keysOf = (items: { id: number }[]) => Object.entries(ids).filter(([, id]) => items.some((item) => item.id === id)).map(([key]) => key).sort();

beforeAll(async () => {
  ADMIN = await makeAccount("admin");
  F = await makeAccount("funcionario");
  OUTRO = await makeAccount("funcionario");
  await ensurePersonalCalendars();
  const [category] = await db.insert(agendaCategories).values({ name: "[TesteF] categoria", color: "rosa", icon: "heart" }).returning();
  const [block] = await db.insert(agendaCategories).values({ name: "[TesteF] bloqueio", slug: `testef-bloqueio-${Date.now()}`, color: "cinza", icon: "tree-palm", blocksDay: true }).returning();
  const [calendar] = await db.insert(agendaCalendars).values({ name: "[TesteF] agenda", kind: "comercial", color: "azul" }).returning();
  // o nome do cliente dos projetos DELE não é segredo para ele (a página do projeto também mostra)
  const [client] = await db.insert(clients).values({ name: "[TesteF] cliente" }).returning();
  const [mine, viewOnly, other] = await db
    .insert(projects)
    .values([
      { title: "[TesteF] projeto meu", clientId: client.id, stage: "gravacao", deliveryDeadline: "2033-05-20" },
      { title: "[TesteF] projeto só ver", clientId: client.id, stage: "edicao" },
      { title: `${S}-projeto-alheio`, clientId: client.id, stage: "gravacao", deliveryDeadline: "2033-05-22" },
    ])
    .returning();
  categoryId = category.id;
  blockCategoryId = block.id;
  calendarId = calendar.id;
  clientId = client.id;
  MEU = mine.id;
  SO_VER = viewOnly.id;
  ALHEIO = other.id;
  await db.insert(projectMembers).values([
    { projectId: MEU, userId: F.id, canView: true, canEdit: true },
    { projectId: SO_VER, userId: F.id, canView: true, canEdit: false },
  ]);

  await make("proprio", { responsibleIds: [F.id], checklist: [{ id: "c1", text: "item", done: false }] }, F);
  await make("responsavel", { date: "2033-05-11", responsibleIds: [F.id] }, ADMIN);
  await make("participante", { date: "2033-05-12", responsibleIds: [ADMIN.id], participantIds: [F.id], notes: `${S}-nota`, checklist: [{ id: "c1", text: "item", done: false }] }, ADMIN);
  await make("do-projeto", { date: "2033-05-13", projectId: MEU, clientId: client.id, responsibleIds: [ADMIN.id] }, ADMIN);
  await make("do-projeto-so-ver", { date: "2033-05-14", projectId: SO_VER, responsibleIds: [ADMIN.id] }, ADMIN);
  await make("projeto-alheio", { title: `${S}-titulo-projeto-alheio`, date: "2033-05-15", projectId: ALHEIO, responsibleIds: [ADMIN.id] }, ADMIN);
  await make("sem-projeto", { title: `${S}-titulo-sem-projeto`, date: "2033-05-16", startTime: "14:00", endTime: "15:00", responsibleIds: [ADMIN.id], location: `${S}-local` }, ADMIN);
  await make("particular-no-projeto", { title: `${S}-titulo-particular`, date: "2033-05-17", projectId: MEU, visibility: "particular", responsibleIds: [ADMIN.id] }, ADMIN);
  await make("particular-comigo", { date: "2033-05-18", visibility: "particular", responsibleIds: [ADMIN.id], participantIds: [F.id] }, ADMIN);
});

afterAll(async () => {
  browser.token = null;
  const mine = await db.select({ id: agendaEvents.id }).from(agendaEvents).where(inArray(agendaEvents.createdBy, [ADMIN.id, F.id, OUTRO.id]));
  if (mine.length) await db.delete(agendaEvents).where(inArray(agendaEvents.id, mine.map((row) => row.id)));
  await db.delete(projects).where(inArray(projects.id, [MEU, SO_VER, ALHEIO]));
  await db.delete(clients).where(eq(clients.id, clientId));
  await db.delete(agendaCategories).where(inArray(agendaCategories.id, [categoryId, blockCategoryId]));
  await db.delete(agendaCalendars).where(eq(agendaCalendars.id, calendarId));
  await removeAccounts();
});

describe("a chave", () => {
  it("a agenda está entre os módulos com alcance por projeto, e o funcionário passa a abrir as telas (sem excluir)", () => {
    expect(PROJECT_SCOPED_PANEL_MODULES).toContain("agenda");
    expect(canUsePanelModule(F, "agenda", "ver")).toBe(true);
    expect(canUsePanelModule(F, "agenda", "editar")).toBe(true);
    expect(canUsePanelModule(F, "agenda", "baixar")).toBe(true);
    expect(canUsePanelModule(F, "agenda", "excluir")).toBe(false);
  });

  it("alcance: funcionário restrito aos projetos dele; admin vê tudo; freelancer e cliente, nada", async () => {
    expect(await agendaAccess(F)).toMatchObject({ view: "restrito", edit: "restrito", viewProjectIds: [MEU, SO_VER].sort((a, b) => a - b), editProjectIds: [MEU] });
    expect(await agendaAccess(ADMIN)).toMatchObject({ view: "todos", edit: "todos" });
    for (const role of ["freelancer", "cliente"] as const) {
      const outsider = await makeAccount(role);
      expect(await agendaAccess(outsider), role).toMatchObject({ view: "nenhum", edit: "nenhum" });
      expect(await listAgenda(outsider, FROM, TO), role).toEqual([]);
      expect(await getEventView(outsider, ids.proprio, null, FROM), role).toBeNull();
    }
  });
});

describe("o que o funcionário VÊ", () => {
  it("lista: só os compromissos em que participa e os dos projetos em que é membro — nenhum mascarado", async () => {
    const items = (await listAgenda(F, FROM, TO)).filter((item) => item.source === "event");
    expect(keysOf(items)).toEqual(["do-projeto", "do-projeto-so-ver", "participante", "particular-comigo", "proprio", "responsavel"]);
    expect(items.some((item) => item.masked)).toBe(false);
    expect(JSON.stringify(items)).not.toContain(S);
    // só os próprios (criou ou é responsável) são dele para alterar
    expect(keysOf(items.filter((item) => item.editable))).toEqual(["proprio", "responsavel"]);
    // o admin vê todos (o particular dele, por inteiro)
    const all = (await listAgenda(ADMIN, FROM, TO)).filter((item) => Object.values(ids).includes(item.id));
    expect(all).toHaveLength(Object.keys(ids).length);
  });

  it("filtros da URL não abrem caminho: projeto alheio, cliente, busca pelo texto do que ele não vê", async () => {
    expect(await listAgenda(F, FROM, TO, { projectId: ALHEIO })).toEqual([]);
    expect(keysOf(await listAgenda(F, FROM, TO, { projectId: MEU }))).toEqual(["do-projeto"]);
    expect(keysOf(await listAgenda(F, FROM, TO, { clientId }))).toEqual(["do-projeto"]);
    expect(await listAgenda(F, FROM, TO, { q: S })).toEqual([]);
    // filtrando pelo admin: só os compromissos do admin que ESTÃO no alcance dele
    expect(keysOf(await listAgenda(F, FROM, TO, { personId: ADMIN.id }))).toEqual(["do-projeto", "do-projeto-so-ver", "participante", "particular-comigo"]);
  });

  it("detalhe: fora do alcance é como se não existisse (o particular alheio nem como “Ocupado”)", async () => {
    for (const key of ["projeto-alheio", "sem-projeto", "particular-no-projeto"]) expect(await getEventView(F, ids[key], null, FROM), key).toBeNull();
    const project = await getEventView(F, ids["do-projeto"], null, FROM);
    expect(project).toMatchObject({ canEdit: false, fullAccess: false });
    expect(project?.event.masked).toBe(false);
    expect(await getEventView(F, ids.proprio, null, FROM)).toMatchObject({ canEdit: true });
    expect(await getEventView(F, ids.responsavel, null, FROM)).toMatchObject({ canEdit: true });
    expect(await getEventView(F, ids.participante, null, FROM)).toMatchObject({ canEdit: false });
    expect(await getEventView(F, ids["particular-comigo"], null, FROM)).toMatchObject({ canEdit: false });
    // para o admin, o particular alheio continua existindo, mascarado
    const other = await makeAccount("admin");
    expect((await getEventView(other, ids["particular-no-projeto"], null, FROM))?.event.masked).toBe(true);
  });

  it("páginas: a agenda abre; detalhe e edição do que não é dele respondem 404", async () => {
    browser.token = F.token;
    const { default: AgendaPage } = await import("@/app/painel/agenda/page");
    const { default: EventPage } = await import("@/app/painel/agenda/[id]/page");
    const { default: EditPage } = await import("@/app/painel/agenda/[id]/editar/page");
    const { default: ConfigPage } = await import("@/app/painel/agenda/config/page");
    const open = (page: (props: never) => unknown, id?: number, query: Record<string, string> = {}) =>
      outcome(async () => (isValidElement(await page({ params: Promise.resolve({ id: String(id) }), searchParams: Promise.resolve(query) } as never)) ? "RENDER" : "?"));
    expect(await open(AgendaPage, undefined, { vista: "mes", data: "2033-05-10" })).toBe("RENDER");
    // disponibilidade mostra a ocupação dos outros: para ele, cai na semana (e a consulta não devolve nada)
    expect(await open(AgendaPage, undefined, { vista: "disponibilidade", data: "2033-05-16" })).toBe("RENDER");
    expect(await getAvailability(F, ["2033-05-16"], [ADMIN.id, F.id])).toBeNull();
    expect(await open(EventPage, ids["do-projeto"])).toBe("RENDER");
    for (const key of ["projeto-alheio", "sem-projeto", "particular-no-projeto"]) expect(await open(EventPage, ids[key]), key).toBe("NOT_FOUND");
    expect(await open(EditPage, ids.proprio)).toBe("RENDER");
    for (const key of ["do-projeto", "participante", "projeto-alheio", "particular-no-projeto", "particular-comigo"]) expect(await open(EditPage, ids[key]), key).toBe("NOT_FOUND");
    // configurações da agenda: só o módulo inteiro
    expect(await open(ConfigPage)).toBe(NO_ACCESS);
    browser.token = null;
  });

  it("exportação .ics: só o que está no alcance, sem “Ocupado” de ninguém", async () => {
    const events = await listIcsEvents(await agendaAccess(F), FROM, TO);
    const uids = events.map((event) => Number(/agenda-(\d+)@/.exec(event.uid)?.[1]));
    expect(keysOf(uids.map((id) => ({ id })))).toEqual(["do-projeto", "do-projeto-so-ver", "participante", "particular-comigo", "proprio", "responsavel"]);
    expect(JSON.stringify(events)).not.toContain(S);
    expect(events.some((event) => event.title === "Ocupado")).toBe(false);
  });

  it("aviso de conflito: o que está fora do alcance aparece só como “Ocupado”", async () => {
    const report = await findEventConflicts(await agendaAccess(F), { date: "2033-05-16", endDate: null, startTime: "14:30", endTime: "15:30", recurrence: null, status: "confirmado", people: [ADMIN.id], blocksDay: false });
    expect(report.total).toBe(1);
    expect(report.conflicts[0]).toMatchObject({ title: "Ocupado", startTime: "14:00", endTime: "15:00" });
    expect(JSON.stringify(report)).not.toContain(S);
  });

  it("linha do tempo: só os projetos dele, com os compromissos que ele alcança", async () => {
    const rows = await getProjectTimeline(F, FROM, TO, "2033-05-01");
    const mine = rows.filter((row) => [MEU, SO_VER, ALHEIO].includes(row.id));
    expect(mine.map((row) => row.id).sort((a, b) => a - b)).toEqual([MEU, SO_VER].sort((a, b) => a - b));
    expect(JSON.stringify(rows)).not.toContain(S);
    expect(mine.find((row) => row.id === MEU)?.events.map((item) => item.id)).toEqual([ids["do-projeto"]]);
    expect(mine.find((row) => row.id === MEU)?.milestones.map((mark) => mark.kind)).toContain("entrega");
    // o outro funcionário, sem projeto nenhum, não recebe linha alguma destas
    expect((await getProjectTimeline(OUTRO, FROM, TO, "2033-05-01")).filter((row) => [MEU, SO_VER, ALHEIO].includes(row.id))).toEqual([]);
  });
});

describe("o que o funcionário ALTERA", () => {
  it("consulta de edição: só os próprios", async () => {
    expect(await getEditableEvent(F, ids.proprio)).not.toBeNull();
    expect(await getEditableEvent(F, ids.responsavel)).not.toBeNull();
    for (const key of ["participante", "do-projeto", "do-projeto-so-ver", "projeto-alheio", "sem-projeto", "particular-no-projeto", "particular-comigo"]) expect(await getEditableEvent(F, ids[key]), key).toBeNull();
  });

  it("actions: no que não é dele, respondem como se o compromisso não existisse — e nada muda no banco", async () => {
    browser.token = F.token;
    for (const key of ["participante", "do-projeto", "projeto-alheio", "sem-projeto", "particular-no-projeto"]) {
      const id = String(ids[key]);
      const before = await loadEventRecord(ids[key]);
      const full = form({ id, scope: "este", title: "[TesteF] invadido", categoryId: String(categoryId), calendarId: String(calendarId), date: "2033-05-25", startTime: "08:00", endTime: "09:00" });
      const attempts: [string, () => Promise<ActionState<unknown>>][] = [
        ["update", () => updateEventAction(initialActionState, full)],
        ["reschedule", () => rescheduleEventAction(initialActionState, form({ id, scope: "este", date: "2033-05-25", startTime: "08:00", endTime: "09:00" }))],
        ["move", () => moveEventAction(initialActionState, form({ id, scope: "este", date: "2033-05-25", startTime: "08:00", endTime: "09:00", ignoreConflicts: "1" }))],
        ["status", () => setEventStatusAction(initialActionState, form({ id, scope: "este", status: "cancelado" }))],
        ["duplicate", () => duplicateEventAction(initialActionState, form({ id }))],
        ["checklist", () => toggleChecklistItemAction(initialActionState, form({ id, list: "checklist", itemId: "c1", done: "on" }))],
      ];
      for (const [name, run] of attempts) {
        const result = (await outcome(run)) as ActionState;
        expect(result, `${key}/${name}`).toMatchObject({ ok: false, message: GONE });
      }
      const after = await loadEventRecord(ids[key]);
      expect(after, key).toMatchObject({ title: before?.title, date: before?.date, startTime: before?.startTime, status: before?.status, checklist: before?.checklist });
    }
    // excluir nunca é do funcionário — nem o próprio
    expect(await outcome(() => deleteEventAction(initialActionState, form({ id: String(ids.proprio), scope: "este" })))).toBe(NO_ACCESS);
    expect(await loadEventRecord(ids.proprio)).not.toBeNull();
    browser.token = null;
  });

  it("no próprio: reagenda, move (arrastar) e marca o checklist", async () => {
    browser.token = F.token;
    const id = String(ids.proprio);
    const moved = (await outcome(() => moveEventAction(initialActionState, form({ id, scope: "este", date: "2033-05-21", startTime: "16:00", endTime: "17:00" })))) as ActionState<{ undo?: string }>;
    expect(moved.ok).toBe(true);
    expect(await loadEventRecord(ids.proprio)).toMatchObject({ date: "2033-05-21", startTime: "16:00", endTime: "17:00" });
    expect((await outcome(() => toggleChecklistItemAction(initialActionState, form({ id, list: "checklist", itemId: "c1", done: "on" })))) as ActionState).toMatchObject({ ok: true });
    expect((await loadEventRecord(ids.proprio))?.checklist[0].done).toBe(true);
    browser.token = null;
  });

  it("criar: ele é sempre responsável; projeto só onde pode editar; o cliente vem do projeto, não do formulário", async () => {
    browser.token = F.token;
    const fields = { title: "[TesteF] criado pelo funcionário", categoryId: String(categoryId), calendarId: String(calendarId), date: "2033-05-26", startTime: "09:00", endTime: "10:00", responsibleIds: JSON.stringify([ADMIN.id]) };
    // projeto alheio e projeto só-ver: recusados, nada é gravado
    for (const projectId of [ALHEIO, SO_VER, 999_999]) {
      const result = (await outcome(() => createEventAction(initialActionState, form({ ...fields, projectId: String(projectId) })))) as ActionState;
      expect(result.ok, String(projectId)).toBe(false);
      expect(result.message).toMatch(/projeto em que participa/);
    }
    expect(await db.select({ id: agendaEvents.id }).from(agendaEvents).where(eq(agendaEvents.title, "[TesteF] criado pelo funcionário"))).toEqual([]);
    // sem projeto, tentando escolher um cliente pelo formulário: o cliente é ignorado
    expect(await outcome(() => createEventAction(initialActionState, form({ ...fields, clientId: String(clientId) })))).toMatch(/^REDIRECT:\/painel\/agenda/);
    // no projeto dele: grava, com o cliente DO PROJETO
    expect(await outcome(() => createEventAction(initialActionState, form({ ...fields, date: "2033-05-27", projectId: String(MEU) })))).toMatch(/^REDIRECT:\/painel\/agenda/);
    const rows = await db.select().from(agendaEvents).where(and(eq(agendaEvents.title, "[TesteF] criado pelo funcionário"), eq(agendaEvents.createdBy, F.id)));
    expect(rows.map((row) => [row.date, row.projectId, row.clientId])).toEqual([
      ["2033-05-26", null, null],
      ["2033-05-27", MEU, clientId],
    ]);
    for (const row of rows) {
      const people = await db.select().from(agendaEventPeople).where(eq(agendaEventPeople.eventId, row.id));
      expect(people.filter((person) => person.role === "responsavel").map((person) => person.userId).sort()).toEqual([ADMIN.id, F.id].sort());
    }
    browser.token = null;
  });

  it("editar o próprio: não consegue passá-lo para um projeto alheio nem sair de responsável", async () => {
    browser.token = F.token;
    const base = { id: String(ids.proprio), scope: "este", title: "[TesteF] proprio", categoryId: String(categoryId), calendarId: String(calendarId), date: "2033-05-21", startTime: "16:00", endTime: "17:00" };
    const refused = (await outcome(() => updateEventAction(initialActionState, form({ ...base, projectId: String(ALHEIO) })))) as ActionState;
    expect(refused).toMatchObject({ ok: false });
    expect((await loadEventRecord(ids.proprio))?.projectId).toBeNull();
    // tira a si mesmo dos responsáveis no formulário: continua responsável
    expect(await outcome(() => updateEventAction(initialActionState, form({ ...base, responsibleIds: JSON.stringify([ADMIN.id]) })))).toMatch(/^REDIRECT:/);
    const record = await loadEventRecord(ids.proprio);
    expect(record?.people.filter((person) => person.role === "responsavel").map((person) => person.userId).sort()).toEqual([ADMIN.id, F.id].sort());
    browser.token = null;
  });

  it("bloquear período: só a própria agenda", async () => {
    browser.token = F.token;
    const other = (await outcome(() => blockPeriodAction(initialActionState, form({ personId: String(ADMIN.id), date: "2033-06-01", endDate: "2033-06-05" })))) as ActionState;
    expect(other).toMatchObject({ ok: false, message: "Você só pode bloquear a sua própria agenda." });
    const own = (await outcome(() => blockPeriodAction(initialActionState, form({ personId: String(F.id), date: "2033-06-01", endDate: "2033-06-05", title: "[TesteF] férias" })))) as ActionState;
    expect(own.ok).toBe(true);
    const [row] = await db.select().from(agendaEvents).where(and(eq(agendaEvents.title, "[TesteF] férias"), eq(agendaEvents.createdBy, F.id)));
    expect(row).toMatchObject({ date: "2033-06-01", endDate: "2033-06-05", startTime: null });
    const [category] = await db.select().from(agendaCategories).where(eq(agendaCategories.id, row.categoryId as number));
    expect(category.blocksDay).toBe(true);
    browser.token = null;
  });
});

describe("revogação", () => {
  it("sair do projeto tira os compromissos do projeto do alcance na consulta seguinte", async () => {
    await db.delete(projectMembers).where(and(eq(projectMembers.projectId, MEU), eq(projectMembers.userId, F.id)));
    expect(await getEventView(F, ids["do-projeto"], null, FROM)).toBeNull();
    expect(keysOf(await listAgenda(F, FROM, TO, { projectId: MEU }))).toEqual([]);
    // os compromissos em que ele participa continuam
    expect(await getEventView(F, ids.participante, null, FROM)).not.toBeNull();
  });
});
