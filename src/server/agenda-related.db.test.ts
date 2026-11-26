/**
 * A AGENDA VISTA DE FORA DA AGENDA, com banco de verdade (banco de teste) e SENTINELAS.
 *
 * Um compromisso PARTICULAR do Pedro — ligado a um cliente e a um projeto, numa categoria de produção, com anexo —
 * nunca chega à Laura (administradora também) por nenhuma consulta de fora da agenda: visão geral, ficha do
 * cliente, projeto, contagem do diálogo de exclusão, "dados deste titular", exportação completa, `/media` e a
 * mensagem de "arquivo em uso". Quem participa vê. E as séries aparecem expandidas.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (browser.token && name.endsWith("nos_session") ? { name, value: browser.token } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidateTag: () => {}, updateTag: () => {}, refresh: () => {}, cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/server/site/queries", () => ({ getPublishedMediaIds: async () => [] }));

import { GET as mediaGET } from "@/app/media/[...key]/route";
import { DELETE as mediaDELETE } from "@/app/painel/api/media/[id]/route";
import { GET as clientDataGET } from "@/app/painel/clientes/[id]/dados/route";
import { GET as dataExportGET } from "@/app/painel/config/dados/exportar/route";
import { db } from "@/db";
import { agendaCategories, agendaEventPeople, agendaEvents, agendaReminderDeliveries, auditLog, clients, media, notifications, projects } from "@/db/schema";
import type { AgendaItem } from "@/lib/agenda/view";
import { addDays } from "@/lib/dates";
import { AGENDA_BUSY_LABEL } from "@/lib/domain";
import { canReadRestrictedMedia } from "@/server/access/media";
import { ensurePersonalCalendars } from "@/server/agenda/settings";
import { getClientRelated } from "@/server/clients/admin";
import { exportClientSubjectData, getClientFootprint } from "@/server/clients/subject-data";
import { exportAllJson } from "@/server/config/data";
import { listUpcomingShoots, listWeekEvents } from "@/server/dashboard/queries";
import { createMedia, findMediaUsage, getMediaById } from "@/server/media";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";
import { collapseSeries, listClientEventRecords, listProjectEvents, listRelatedAgenda, productionCategoryIds, seesSomeEventInFull } from "./agenda-related";

/** Tudo o que é conteúdo do compromisso particular leva este texto: se aparecer em qualquer saída, vazou. */
const S = "SENTINELA-PARTICULAR";
const ORIGIN = "http://localhost:3000";
const TODAY = "2031-03-03"; // segunda-feira

let pedro: TestAccount; // dono do compromisso particular
let laura: TestAccount; // administradora também — não participa
let caio: TestAccount; // gestor, participante do particular
let gestor: TestAccount; // vê a agenda inteira, não participa
let funcionario: TestAccount; // não vê a agenda inteira
let clientId = 0;
let projectId = 0;
let productionCategoryId = 0;
let secretId = 0; // particular do Pedro (série semanal)
let normalId = 0; // compromisso comum, diário por 3 dias
let cancelledId = 0;
let pastId = 0;
let secretFile: Awaited<ReturnType<typeof createMedia>>;
let normalFile: Awaited<ReturnType<typeof createMedia>>;
const eventIds: number[] = [];

const viewer = (account: TestAccount) => ({ id: account.id, role: account.role, permissions: account.permissions });
const pdf = (label: string) => Buffer.from(`%PDF-1.7\n1 0 obj\n<<>>\nendobj\n% ${label}\n%%EOF`);
const ours = (items: AgendaItem[]) => items.filter((item) => eventIds.includes(item.id));
const dump = (value: unknown) => JSON.stringify(value);

beforeAll(async () => {
  pedro = await makeAccount("admin");
  laura = await makeAccount("admin");
  caio = await makeAccount("gestor");
  gestor = await makeAccount("gestor");
  funcionario = await makeAccount("funcionario");
  await ensurePersonalCalendars();

  const [category] = await db.insert(agendaCategories).values({ name: "[Teste] produção", color: "lima", icon: "video", isProduction: true }).returning();
  productionCategoryId = category.id;
  const [client] = await db.insert(clients).values({ name: "[Teste] Cliente da agenda vista de fora" }).returning();
  clientId = client.id;
  const [project] = await db.insert(projects).values({ title: "[Teste] Projeto da agenda vista de fora", clientId }).returning();
  projectId = project.id;

  secretFile = await createMedia({ buffer: pdf("particular"), originalName: `${S}-exame.pdf`, alt: `${S}-alt`, visibility: "private", userId: pedro.id });
  normalFile = await createMedia({ buffer: pdf("roteiro"), originalName: "roteiro.pdf", visibility: "private", userId: pedro.id });

  const [secret] = await db
    .insert(agendaEvents)
    .values({
      title: `${S}-titulo`,
      categoryId: productionCategoryId,
      description: `${S}-descricao`,
      date: addDays(TODAY, 1),
      startTime: "14:00",
      endTime: "15:00",
      location: `${S}-local`,
      mapUrl: `https://maps.example/${S}`,
      meetingUrl: `https://meet.example/${S}`,
      clientId,
      projectId,
      visibility: "particular",
      checklist: [{ id: "a", text: `${S}-checklist`, done: false }],
      notes: `${S}-notas`,
      recurrence: { freq: "semanal", interval: 1 },
      attachments: [secretFile.id],
      production: { address: `${S}-endereco`, crewArrival: null, script: `${S}-roteiro`, references: "", equipment: `${S}-equipamento`, contentCount: null, estimatedMinutes: null, editDeadline: null, deliveryDate: null, prepChecklist: [] },
      createdBy: pedro.id,
      ownerId: pedro.id,
    })
    .returning();
  secretId = secret.id;
  await db.insert(agendaEventPeople).values([
    { eventId: secretId, userId: pedro.id, role: "responsavel" },
    { eventId: secretId, userId: caio.id, role: "participante" },
    { eventId: secretId, userId: null, role: "externo", externalName: `${S}-convidado` },
  ]);

  const [normal] = await db
    .insert(agendaEvents)
    .values({
      title: "[Teste] Gravação comum",
      categoryId: productionCategoryId,
      date: TODAY,
      startTime: "09:00",
      endTime: "10:00",
      clientId,
      projectId,
      recurrence: { freq: "diaria", interval: 1, count: 3 },
      attachments: [normalFile.id],
      createdBy: pedro.id,
    })
    .returning();
  normalId = normal.id;
  const [cancelled] = await db
    .insert(agendaEvents)
    .values({ title: "[Teste] Reunião cancelada", categoryId: productionCategoryId, date: addDays(TODAY, 2), clientId, projectId, status: "cancelado", createdBy: pedro.id })
    .returning();
  cancelledId = cancelled.id;
  const [past] = await db
    .insert(agendaEvents)
    .values({ title: "[Teste] Reunião que já passou", categoryId: productionCategoryId, date: addDays(TODAY, -20), clientId, projectId, createdBy: pedro.id })
    .returning();
  pastId = past.id;
  eventIds.push(secretId, normalId, cancelledId, pastId);
});

beforeEach(() => {
  browser.token = null;
});

afterAll(async () => {
  await db.delete(agendaEvents).where(inArray(agendaEvents.id, eventIds));
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(clients).where(eq(clients.id, clientId));
  await db.delete(agendaCategories).where(eq(agendaCategories.id, productionCategoryId));
  await db.delete(media).where(inArray(media.id, [secretFile.id, normalFile.id]));
  await removeAccounts();
});

describe("visão geral", () => {
  it("a Laura só recebe “Ocupado” no horário — sem título, local, cliente nem categoria", async () => {
    const week = ours(await listWeekEvents(viewer(laura), TODAY));
    expect(dump(week)).not.toContain(S);
    const busy = week.filter((item) => item.id === secretId);
    expect(busy).toHaveLength(1); // semanal: uma ocorrência na janela de 7 dias
    expect(busy[0]).toMatchObject({ masked: true, title: AGENDA_BUSY_LABEL, date: addDays(TODAY, 1), startTime: "14:00", endTime: "15:00", location: "", clientName: null, label: "", color: "cinza", categoryId: null, people: [], ownerName: pedro.name });
  });

  it("a série diária aparece EXPANDIDA (uma linha por dia) e o cancelado fica de fora", async () => {
    const week = ours(await listWeekEvents(viewer(laura), TODAY));
    expect(week.filter((item) => item.id === normalId).map((item) => item.date)).toEqual([TODAY, addDays(TODAY, 1), addDays(TODAY, 2)]);
    expect(week.find((item) => item.id === normalId)).toMatchObject({ masked: false, label: "[Teste] produção", color: "lima", recurring: true });
    expect(week.some((item) => item.id === cancelledId)).toBe(false);
  });

  it("“Próximas gravações e eventos” (filtro por categoria de produção) não traz o particular nem como “Ocupado”", async () => {
    expect(await productionCategoryIds()).toContain(productionCategoryId);
    const shoots = await listUpcomingShoots(viewer(laura), TODAY, 500);
    expect(dump(shoots)).not.toContain(S);
    expect(shoots.some((item) => item.id === secretId)).toBe(false);
    expect(shoots.some((item) => item.id === normalId)).toBe(true);
    expect(shoots.every((item) => !item.masked)).toBe(true);
  });

  it("o Pedro (dono) e o Caio (participante) veem o compromisso por inteiro", async () => {
    for (const account of [pedro, caio]) {
      const mine = ours(await listWeekEvents(viewer(account), TODAY)).find((item) => item.id === secretId);
      expect(mine, account.name).toMatchObject({ masked: false, title: `${S}-titulo`, location: `${S}-local` });
      expect((await listUpcomingShoots(viewer(account), TODAY, 500)).some((item) => item.id === secretId), account.name).toBe(true);
    }
  });

  it("quem não vê a Agenda no módulo inteiro (funcionário) não recebe nada", async () => {
    expect(ours(await listWeekEvents(viewer(funcionario), TODAY))).toEqual([]);
    expect(ours(await listUpcomingShoots(viewer(funcionario), TODAY, 500))).toEqual([]);
  });
});

describe("ficha do cliente e projeto", () => {
  it("ficha do cliente: a Laura vê só o compromisso comum (série recolhida numa linha); nada do particular", async () => {
    const related = await getClientRelated(viewer(laura), clientId, TODAY, { proposals: false, projects: false, contracts: false, finance: false, events: true, tasks: false });
    expect(dump(related)).not.toContain(S);
    expect(related.events.map((item) => item.id)).toEqual([normalId]);
    expect(related.events[0]).toMatchObject({ date: TODAY, recurring: true, label: "[Teste] produção", href: `/painel/agenda/${normalId}?dia=${TODAY}` });
  });

  it("ficha do cliente: sem permissão na agenda (`events: false`) nada é consultado", async () => {
    const related = await getClientRelated(viewer(laura), clientId, TODAY, { proposals: false, projects: false, contracts: false, finance: false, events: false, tasks: false });
    expect(related.events).toEqual([]);
  });

  it("projeto: a Laura vê os comuns (futuros antes, depois os passados; cancelado com o status) e nada do particular", async () => {
    const events = await listProjectEvents(viewer(laura), projectId, TODAY);
    expect(dump(events)).not.toContain(S);
    expect(events.map((item) => item.id)).toEqual([normalId, cancelledId, pastId]);
    expect(events[1]).toMatchObject({ status: "cancelado" });
  });

  it("quem participa vê o particular na ficha do cliente e no projeto", async () => {
    for (const account of [pedro, caio]) {
      const related = await getClientRelated(viewer(account), clientId, TODAY, { proposals: false, projects: false, contracts: false, finance: false, events: true, tasks: false });
      expect(related.events.map((item) => item.id), account.name).toEqual([normalId, secretId]);
      expect((await listProjectEvents(viewer(account), projectId, TODAY)).some((item) => item.id === secretId), account.name).toBe(true);
    }
  });

  it("o filtro por cliente ou projeto nunca devolve item mascarado (o filtro não vira oráculo)", async () => {
    for (const filter of [{ clientId }, { projectId }, { categoryIds: [productionCategoryId] }]) {
      const items = await listRelatedAgenda(viewer(laura), addDays(TODAY, -30), addDays(TODAY, 60), filter, { includeCancelled: true });
      expect(items.some((item) => item.masked || item.id === secretId), dump(filter)).toBe(false);
    }
  });

  it("a contagem do diálogo de exclusão não conta o particular para quem não participa", async () => {
    expect((await getClientFootprint(clientId, viewer(laura)))?.events).toBe(3);
    expect((await getClientFootprint(clientId, viewer(pedro)))?.events).toBe(4);
    expect((await getClientFootprint(clientId, viewer(caio)))?.events).toBe(4);
  });
});

describe("recolher séries", () => {
  const item = (id: number, date: string, endDate = date) => ({ id, date, endDate, key: `e-${id}@${date}` }) as AgendaItem;

  it("fica a próxima ocorrência a partir de hoje; se a série acabou, a última", () => {
    const items = [item(1, "2031-02-24"), item(2, "2031-02-25"), item(1, "2031-03-03"), item(1, "2031-03-10"), item(2, "2031-02-26"), item(3, "2031-03-05")];
    expect(collapseSeries(items, "2031-03-03").map((entry) => entry.key)).toEqual(["e-1@2031-03-03", "e-2@2031-02-26", "e-3@2031-03-05"]);
  });

  it("compromisso de vários dias em andamento conta como futuro", () => {
    expect(collapseSeries([item(1, "2031-03-01", "2031-03-04"), item(1, "2031-03-08", "2031-03-11")], "2031-03-03").map((entry) => entry.key)).toEqual(["e-1@2031-03-01"]);
  });
});

describe("dados deste titular (LGPD)", () => {
  it("exportado pela Laura: o particular não entra; o arquivo e o retorno dizem que 1 ficou de fora e de quem é", async () => {
    const result = await exportClientSubjectData(clientId, new Date("2031-03-03T12:00:00Z"), viewer(laura));
    expect(result!.json).not.toContain(S);
    const data = JSON.parse(result!.json);
    expect(data.agenda.map((row: { id: number }) => row.id).sort()).toEqual([normalId, cancelledId, pastId].sort());
    expect(data.contagem.agenda).toBe(3);
    expect(result!.withheldEvents).toBe(1);
    expect(data.agendaNaoIncluida).toEqual({ compromissos: 1, particularesDe: [pedro.name] });
    expect(data.observacoes.join(" ")).toContain("resposta incompleta");
    // o que sai de um compromisso comum: categoria (não o tipo antigo), repetição em texto, sem ids de anexos
    expect(data.agenda.find((row: { id: number }) => row.id === normalId)).toMatchObject({ titulo: "[Teste] Gravação comum", categoria: "[Teste] produção", particular: false, repeticao: "Todo dia, 3 vezes", anexos: 1 });
  });

  it("exportado pelo Pedro (dono): entra inteiro, marcado como particular, e nada fica de fora", async () => {
    const result = await exportClientSubjectData(clientId, new Date("2031-03-03T12:00:00Z"), viewer(pedro));
    const data = JSON.parse(result!.json);
    expect(data.agenda.find((row: { id: number }) => row.id === secretId)).toMatchObject({ titulo: `${S}-titulo`, particular: true, local: `${S}-local`, observacoes: `${S}-notas` });
    expect(result!.withheldEvents).toBe(0);
    expect(data.agendaNaoIncluida).toBeUndefined();
  });

  it("a rota registra na auditoria quantos ficaram de fora — sem o conteúdo", async () => {
    browser.token = laura.token;
    const response = await clientDataGET(new Request(`${ORIGIN}/painel/clientes/${clientId}/dados`), { params: Promise.resolve({ id: String(clientId) }) });
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(S);
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.userId, laura.id), eq(auditLog.action, "export"), eq(auditLog.entity, "client"), eq(auditLog.entityId, String(clientId))));
    expect(entry.summary).toContain("1 compromisso(s) da agenda");
    expect(entry.summary).not.toContain(S);
  });

  it("os registros de um cliente chegam separados: inteiros, mascarados, fora do alcance", async () => {
    const forLaura = await listClientEventRecords(viewer(laura), clientId);
    expect({ visible: forLaura.visible.length, masked: forLaura.masked.length, unreachable: forLaura.unreachable }).toEqual({ visible: 3, masked: 1, unreachable: 0 });
    expect(dump(forLaura)).not.toContain(S);
    expect(Object.keys(forLaura.masked[0]).sort()).toEqual(["cancelled", "date", "endDate", "endTime", "id", "masked", "ownerId", "ownerName", "recurrence", "recurrenceExceptions", "startTime", "title"]);
    // sem a Agenda no módulo inteiro, a agenda não entrega nada — e isso é contado, não escondido
    const forStaff = await listClientEventRecords(viewer(funcionario), clientId);
    expect({ visible: forStaff.visible.length, masked: forStaff.masked.length, unreachable: forStaff.unreachable }).toEqual({ visible: 0, masked: 0, unreachable: 4 });
  });
});

describe("exportação completa (JSON)", () => {
  it("exportada pela Laura: o particular do Pedro sai só como “Ocupado” — linha, pessoas e nome do anexo", async () => {
    const { json, counts, maskedPrivateEvents } = await exportAllJson(new Date("2031-03-03T12:00:00Z"), viewer(laura));
    expect(json).not.toContain(S);
    const { tabelas, observacoes } = JSON.parse(json);
    const row = tabelas.agenda_events.find((event: { id: number }) => event.id === secretId);
    expect(row).toEqual({
      id: secretId,
      oculto: true,
      visibility: "particular",
      title: AGENDA_BUSY_LABEL,
      date: addDays(TODAY, 1),
      endDate: null,
      startTime: "14:00",
      endTime: "15:00",
      recurrence: { freq: "semanal", interval: 1 },
      recurrenceExceptions: [],
      cancelado: false,
      createdBy: pedro.id,
    });
    const people = tabelas.agenda_event_people.filter((person: { eventId: number }) => person.eventId === secretId);
    expect(people).toHaveLength(3);
    for (const person of people) expect(Object.keys(person).sort()).toEqual(["eventId", "id", "oculto"]);
    expect(tabelas.media.find((file: { id: number }) => file.id === secretFile.id)).toMatchObject({ originalName: "", alt: "", oculto: true });
    // o que não é particular sai inteiro, e as contagens continuam batendo com as tabelas
    expect(tabelas.agenda_events.find((event: { id: number }) => event.id === normalId)).toMatchObject({ title: "[Teste] Gravação comum", clientId, projectId });
    expect(tabelas.media.find((file: { id: number }) => file.id === normalFile.id)).toMatchObject({ originalName: "roteiro.pdf" });
    expect(counts.agenda_events).toBe(tabelas.agenda_events.length);
    expect(counts.agenda_event_people).toBe(tabelas.agenda_event_people.length);
    expect(maskedPrivateEvents).toBeGreaterThanOrEqual(1);
    expect(observacoes.join(" ")).toContain("Ocupado");
  });

  it("avisos e lembretes de um particular (caixa de cada pessoa) não entram na exportação de ninguém", async () => {
    // o lembrete de um particular vai só para quem participa — e leva o título e o local
    await db.insert(notifications).values({ userId: pedro.id, type: "agenda_lembrete", title: `Lembrete: ${S}-titulo`, body: `${S}-local`, href: `/painel/agenda/${secretId}` });
    await db.insert(agendaReminderDeliveries).values({ eventId: secretId, occurrenceStart: `${addDays(TODAY, 1)}T14:00`, minutes: 60, channel: "interno", userId: caio.id });
    for (const account of [laura, pedro]) {
      const { json } = await exportAllJson(new Date("2031-03-03T12:00:00Z"), viewer(account));
      const { tabelas } = JSON.parse(json);
      expect(tabelas.notifications, account.name).toBeUndefined();
      expect(tabelas.agenda_reminder_deliveries, account.name).toBeUndefined();
    }
    expect((await exportAllJson(new Date("2031-03-03T12:00:00Z"), viewer(laura))).json).not.toContain(S);
  });

  it("exportada pelo Pedro (dono) ou pelo Caio (participante): o compromisso sai inteiro", async () => {
    for (const account of [pedro, caio]) {
      const { json } = await exportAllJson(new Date("2031-03-03T12:00:00Z"), viewer(account));
      const { tabelas } = JSON.parse(json);
      expect(tabelas.agenda_events.find((event: { id: number }) => event.id === secretId), account.name).toMatchObject({ title: `${S}-titulo`, notes: `${S}-notas`, clientId, projectId });
      expect(tabelas.agenda_event_people.filter((person: { eventId: number; oculto?: boolean }) => person.eventId === secretId && !person.oculto), account.name).toHaveLength(3);
    }
  });

  it("quem exporta sem enxergar a agenda recebe TODO particular mascarado (falha fechada)", async () => {
    const { json } = await exportAllJson(new Date("2031-03-03T12:00:00Z"), viewer(funcionario));
    expect(json).not.toContain(S);
    expect(JSON.parse(json).tabelas.agenda_events.find((event: { id: number }) => event.id === secretId)).toEqual({ id: secretId, oculto: true, visibility: "particular", title: AGENDA_BUSY_LABEL });
  });

  it("a rota exporta para quem está logado e registra na auditoria quantos saíram mascarados", async () => {
    browser.token = laura.token;
    const response = await dataExportGET(new Request(`${ORIGIN}/painel/config/dados/exportar`));
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain(S);
    const entries = await db.select().from(auditLog).where(and(eq(auditLog.userId, laura.id), eq(auditLog.action, "export"), eq(auditLog.entity, "dados"), like(auditLog.summary, "Exportação completa%")));
    expect(entries.at(-1)?.summary).toMatch(/compromisso\(s\) particular\(es\) de outras pessoas só como "Ocupado"/);
  });
});

describe("anexos da agenda (/media e “arquivo em uso”)", () => {
  const open = (row: { storageKey: string }) => mediaGET(new Request(`${ORIGIN}/media/${row.storageKey}`), { params: Promise.resolve({ key: row.storageKey.split("/") }) });
  const statusFor = async (account: TestAccount | null, row: { storageKey: string }) => {
    browser.token = account?.token ?? null;
    return (await open(row)).status;
  };

  it("anexo de compromisso PARTICULAR: só o dono e quem participa abrem — nem a outra administradora", async () => {
    expect(await statusFor(pedro, secretFile)).toBe(200);
    expect(await statusFor(caio, secretFile)).toBe(200);
    expect(await statusFor(laura, secretFile)).toBe(404);
    expect(await statusFor(gestor, secretFile)).toBe(404);
    expect(await statusFor(funcionario, secretFile)).toBe(404);
    expect(await statusFor(null, secretFile)).toBe(404);
  });

  it("anexo de compromisso comum: quem vê a Agenda no módulo inteiro abre; o funcionário e o anônimo, não", async () => {
    expect(await statusFor(laura, normalFile)).toBe(200);
    expect(await statusFor(gestor, normalFile)).toBe(200);
    expect(await statusFor(funcionario, normalFile)).toBe(404);
    expect(await statusFor(null, normalFile)).toBe(404);
  });

  it("um ajuste que nega “ver” na Agenda fecha os anexos, mesmo com “ver” em Arquivos", async () => {
    const semAgenda = await makeAccount("gestor", { permissions: { grant: [], deny: ["agenda:ver"] } });
    expect(await canReadRestrictedMedia(viewer(semAgenda), normalFile)).toBe(false);
    expect(await canReadRestrictedMedia(viewer(semAgenda), secretFile)).toBe(false);
  });

  it("a regra pura: ver por inteiro algum dos compromissos que usam o arquivo", async () => {
    expect(await seesSomeEventInFull(viewer(laura), [secretId])).toBe(false);
    expect(await seesSomeEventInFull(viewer(laura), [secretId, normalId])).toBe(true);
    expect(await seesSomeEventInFull(viewer(caio), [secretId])).toBe(true);
    expect(await seesSomeEventInFull(viewer(laura), [])).toBe(false);
  });

  it("findMediaUsage enxerga o anexo — sem título nem data do compromisso", async () => {
    expect(await findMediaUsage(secretFile.id)).toEqual(["um compromisso da agenda (anexo)"]);
    expect(await findMediaUsage(normalFile.id)).toEqual(["um compromisso da agenda (anexo)"]);
  });

  it("DELETE /painel/api/media/[id] recusa (409) apagar um anexo em uso e não revela o compromisso", async () => {
    browser.token = laura.token;
    for (const file of [secretFile, normalFile]) {
      const response = await mediaDELETE(new Request(`${ORIGIN}/painel/api/media/${file.id}`, { method: "DELETE", headers: { origin: ORIGIN, host: "localhost:3000" } }), { params: Promise.resolve({ id: String(file.id) }) });
      expect(response.status).toBe(409);
      const body = await response.text();
      expect(body).toContain("compromisso da agenda");
      expect(body).not.toContain(S);
      expect(await getMediaById(file.id)).not.toBeNull();
    }
  });

  it("solto do compromisso, o arquivo volta a poder ser apagado", async () => {
    const file = await createMedia({ buffer: pdf("avulso"), originalName: "avulso.pdf", visibility: "private", userId: pedro.id });
    const [event] = await db.insert(agendaEvents).values({ title: "[Teste] com anexo", date: TODAY, attachments: [file.id], createdBy: pedro.id }).returning();
    expect(await findMediaUsage(file.id)).toHaveLength(1);
    await db.update(agendaEvents).set({ attachments: [] }).where(eq(agendaEvents.id, event.id));
    expect(await findMediaUsage(file.id)).toEqual([]);
    browser.token = laura.token;
    const response = await mediaDELETE(new Request(`${ORIGIN}/painel/api/media/${file.id}`, { method: "DELETE", headers: { origin: ORIGIN, host: "localhost:3000" } }), { params: Promise.resolve({ id: String(file.id) }) });
    expect(response.status).toBe(204);
    await db.delete(agendaEvents).where(eq(agendaEvents.id, event.id));
  });
});

describe("ninguém fora da agenda lê a tabela de compromissos", () => {
  /**
   * Arquivos de `src/` e `scripts/` (fora de `src/server/agenda`, do schema e dos testes) que podem citar
   * `agendaEvents` / `agendaEventPeople`, e por quê. Arquivo novo que cite a tabela faz este teste falhar: leia os
   * compromissos por `@/server/agenda-related` (ou `@/server/agenda/queries`), que aplicam a privacidade.
   */
  const ALLOWED: Record<string, string> = {
    "src/server/agenda-related.ts": "só ids; cada compromisso volta a passar por getEventView",
    "src/server/media/index.ts": "só ids dos compromissos que usam um arquivo (findMediaUsage)",
    "src/server/projects/admin.ts": "só o UPDATE que desliga o projeto excluído",
    "src/server/notifications/reminders.ts": "despachante de lembretes: lê pelos registros da agenda e só envia às pessoas do próprio compromisso",
  };

  function sourceFiles(dir: string): string[] {
    return readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
      const relative = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [relative] : [];
    });
  }

  it("só os arquivos da lista citam `agendaEvents` / `agendaEventPeople` / `agenda_events`", () => {
    const outside = [...sourceFiles("src"), ...sourceFiles("scripts")].filter(
      (file) => !file.startsWith("src/server/agenda/") && !file.startsWith("src/db/") && !file.startsWith("src/test/"),
    );
    const readers = outside.filter((file) => /\bagendaEvents\b|\bagendaEventPeople\b|\bfrom agenda_events\b|\bjoin agenda_events\b/i.test(readFileSync(path.join(process.cwd(), file), "utf8")));
    expect(readers.sort()).toEqual(Object.keys(ALLOWED).sort());
  });

  it("os arquivos da lista não selecionam conteúdo de compromisso (título, local, notas…)", () => {
    for (const file of Object.keys(ALLOWED)) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/agendaEvents\.(title|description|location|notes|mapUrl|meetingUrl|checklist|production|kind|categoryId|calendarId)\b/);
      expect(source, file).not.toMatch(/select\(\)\s*\.from\(agendaEvents\)/);
    }
  });
});
