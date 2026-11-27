/**
 * PAINEL RESTRITO DO FUNCIONÁRIO, com dados de verdade (banco de teste; cookies e navegação simulados):
 * "um usuário não pode acessar dados de outro por mudança de URL ou identificador" (briefing v2, seção 28).
 *
 * Cenário: três projetos — MEU (o funcionário é membro e pode editar), SO_VER (membro, só ver) e ALHEIO (não é
 * membro) — mais uma tarefa sem projeto. Tudo o que é do ALHEIO carrega o texto-sentinela "SEGREDO".
 *
 * Confere, para o funcionário: as páginas (lista e detalhe de projeto, tarefas, visão geral), as consultas
 * (`listProjects`, `listTasks`, visão geral) e TODAS as actions de projeto e tarefa — trocando o id para o do
 * projeto alheio, para um id inexistente e para um projeto em que ele só pode ver. E que tirar a pessoa do
 * projeto vale na requisição seguinte.
 */
import { eq, inArray } from "drizzle-orm";
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
  usePathname: () => "/painel",
  useRouter: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidateTag: () => {}, updateTag: () => {}, cacheTag: () => {}, cacheLife: () => {} }));
vi.mock("@/components/ui/flash", () => ({ flashToast: async () => {} }));

import { db } from "@/db";
import { clients, financeEntries, leads, projectMembers, projects, tasks } from "@/db/schema";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { todayISO } from "@/lib/dates";
import { moduleScope, scopeAllows } from "@/server/access";
import { dashboardAccess, getIssues, getSummary, listImportantTasks } from "@/server/dashboard/queries";
import { getProjectOptions } from "@/server/options";
import { listProjects } from "@/server/projects/admin";
import { listTasks } from "@/server/tasks/admin";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import ProjectPage from "./projetos/[id]/page";
import ProjectsPage from "./projetos/page";
import {
  addChecklistItemAction,
  addProjectMemberAction,
  addProjectTaskAction,
  createProjectAction,
  deleteProjectAction,
  moveProjectAction,
  removeChecklistItemAction,
  removeProjectMemberAction,
  toggleChecklistItemAction,
  updateProjectAction,
  updateProjectMemberAction,
  updateProjectStageAction,
} from "./projetos/actions";
import TasksPage from "./tarefas/page";
import { createTaskAction, deleteTaskAction, setTaskDoneAction, updateTaskAction } from "./tarefas/actions";
import HomePage from "./page";

const SECRET = "SEGREDO";
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";
const today = todayISO();

let funcionario: TestAccount;
let colega: TestAccount; // outro funcionário, membro só do projeto ALHEIO
let gestor: TestAccount;
let admin: TestAccount;
let clientMine = 0;
let clientOther = 0;
let MEU = 0;
let SO_VER = 0;
let ALHEIO = 0;
const task = { mine: 0, viewOnly: 0, other: 0, loose: 0 };
const cleanup = { projects: [] as number[], clients: [] as number[], tasks: [] as number[], finance: [] as number[], leads: [] as number[] };

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const as = (account: TestAccount | null) => {
  browser.token = account?.token ?? null;
};
const taskRow = async (id: number) => (await db.select().from(tasks).where(eq(tasks.id, id)))[0];
const projectRow = async (id: number) => (await db.select().from(projects).where(eq(projects.id, id)))[0];
const denied = (result: unknown) => expect(result).toMatchObject({ ok: false, message: expect.stringMatching(/não tem permissão/) });

/**
 * Tudo o que a página entregou para ser desenhado: os textos e as props da árvore que ela devolveu (sem executar
 * os componentes filhos). É uma visão MAIS LARGA do que a tela — inclui o que foi passado a um componente e ele
 * não mostraria —, então "não contém" aqui garante que o dado nem saiu da página.
 */
async function html(render: () => Promise<unknown>): Promise<string> {
  const result = await outcome(render);
  if (typeof result === "string") return result;
  if (!isValidElement(result)) throw new Error("a página não devolveu um elemento");
  const seen = new WeakSet<object>();
  const parts: string[] = [];
  const walk = (value: unknown, key = ""): void => {
    if (value === null || value === undefined || typeof value === "function" || typeof value === "boolean") return;
    if (typeof value !== "object") return void parts.push(key ? `${key}=${String(value)}` : String(value));
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) return value.forEach((item) => walk(item, key));
    if (value instanceof Date) return void parts.push(value.toISOString());
    for (const [name, inner] of Object.entries(value)) {
      if (name === "type" || name === "_owner" || name === "_store" || name === "ref") continue;
      walk(inner, name === "props" || name === "children" ? "" : name);
    }
  };
  walk(result);
  return parts.join(" | ");
}

beforeAll(async () => {
  [funcionario, colega, gestor, admin] = await Promise.all([makeAccount("funcionario"), makeAccount("funcionario"), makeAccount("gestor"), makeAccount("admin")]);
  const insertedClients = await db
    .insert(clients)
    .values([{ name: "[Teste] Cliente do meu projeto" }, { name: `[Teste] ${SECRET}-CLIENTE-ALHEIO`, notes: `${SECRET}-NOTA` }])
    .returning({ id: clients.id });
  [clientMine, clientOther] = insertedClients.map((row) => row.id);
  cleanup.clients.push(clientMine, clientOther);

  const insertedProjects = await db
    .insert(projects)
    .values([
      { title: "[Teste] Projeto MEU", clientId: clientMine, stage: "gravacao", deliveryDeadline: "2020-01-10", notes: `${SECRET}-OBSERVACAO-INTERNA`, driveUrl: "https://drive.example/meu", checklist: [{ id: "item-meu", text: "Item do meu projeto", done: false }] },
      { title: "[Teste] Projeto SO_VER", clientId: clientMine, stage: "gravacao", driveUrl: "https://drive.example/so-ver" },
      { title: `[Teste] ${SECRET}-PROJETO-ALHEIO`, clientId: clientOther, stage: "gravacao", deliveryDeadline: "2020-01-05", notes: `${SECRET}-NOTA-ALHEIA`, checklist: [{ id: "item-alheio", text: `${SECRET}-ITEM`, done: false }] },
    ])
    .returning({ id: projects.id });
  [MEU, SO_VER, ALHEIO] = insertedProjects.map((row) => row.id);
  cleanup.projects.push(MEU, SO_VER, ALHEIO);

  await db.insert(projectMembers).values([
    { projectId: MEU, userId: funcionario.id, role: "Editor", canView: true, canEdit: true, canDownload: false },
    { projectId: SO_VER, userId: funcionario.id, role: "Assistente", canView: true, canEdit: false },
    { projectId: ALHEIO, userId: colega.id, role: "Fotógrafo", canView: true, canEdit: true },
  ]);

  const insertedTasks = await db
    .insert(tasks)
    .values([
      { title: "[Teste] tarefa do meu projeto", projectId: MEU, clientId: clientMine, dueDate: "2020-01-01", priority: "alta" },
      { title: "[Teste] tarefa do projeto só-ver", projectId: SO_VER, clientId: clientMine, dueDate: "2020-01-02" },
      { title: `[Teste] ${SECRET}-TAREFA-ALHEIA`, projectId: ALHEIO, clientId: clientOther, dueDate: "2020-01-03", priority: "alta" },
      { title: `[Teste] ${SECRET}-TAREFA-SEM-PROJETO`, dueDate: "2020-01-04", priority: "alta" },
    ])
    .returning({ id: tasks.id });
  [task.mine, task.viewOnly, task.other, task.loose] = insertedTasks.map((row) => row.id);
  cleanup.tasks.push(...insertedTasks.map((row) => row.id));

  const [entry] = await db
    .insert(financeEntries)
    .values({ type: "receita", category: "servico", description: `[Teste] ${SECRET}-RECEITA`, amountCents: 987_654, dueDate: "2020-01-01", projectId: MEU, clientId: clientMine })
    .returning({ id: financeEntries.id });
  cleanup.finance.push(entry.id);
  const [lead] = await db.insert(leads).values({ name: `[Teste] ${SECRET}-LEAD`, whatsapp: "11999990000", status: "novo" }).returning({ id: leads.id });
  cleanup.leads.push(lead.id);
});

afterAll(async () => {
  await db.delete(financeEntries).where(inArray(financeEntries.id, cleanup.finance));
  await db.delete(leads).where(inArray(leads.id, cleanup.leads));
  await db.delete(tasks).where(inArray(tasks.projectId, cleanup.projects));
  await db.delete(tasks).where(inArray(tasks.id, cleanup.tasks));
  await db.delete(projects).where(inArray(projects.id, cleanup.projects));
  await db.delete(clients).where(inArray(clients.id, cleanup.clients));
  await removeAccounts();
});

describe("funcionário: escopo (em quais projetos ele pode o quê)", () => {
  it("vê os dois projetos em que é membro; edita só onde tem 'editar'; nunca exclui", async () => {
    expect(await moduleScope(funcionario, "projetos", "ver")).toEqual([MEU, SO_VER].sort((a, b) => a - b));
    expect(await moduleScope(funcionario, "tarefas", "ver")).toEqual([MEU, SO_VER].sort((a, b) => a - b));
    expect(await moduleScope(funcionario, "projetos", "editar")).toEqual([MEU]);
    expect(await moduleScope(funcionario, "tarefas", "editar")).toEqual([MEU]);
    expect(await moduleScope(funcionario, "projetos", "baixar")).toEqual([]);
    expect(await moduleScope(funcionario, "projetos", "excluir")).toEqual([]);
    expect(await moduleScope(funcionario, "tarefas", "excluir")).toEqual([]);
    // agenda: os projetos em que é membro (o alcance completo — compromissos em que participa — é de `agendaAccess`)
    expect(await moduleScope(funcionario, "agenda", "ver")).toEqual([MEU, SO_VER].sort((a, b) => a - b));
    expect(await moduleScope(funcionario, "agenda", "editar")).toEqual([MEU]);
    expect(await moduleScope(funcionario, "agenda", "excluir")).toEqual([]);
    // módulos que as telas ainda não filtram por projeto: nada (falha fechada), mesmo com "(P)" na matriz
    for (const mod of ["conteudo", "marca", "arquivos"] as const) expect(await moduleScope(funcionario, mod, "ver"), mod).toEqual([]);
    // módulos fora do perfil
    for (const mod of ["financeiro", "clientes", "leads", "propostas", "contratos", "usuarios"] as const) expect(await moduleScope(funcionario, mod, "ver"), mod).toEqual([]);
    expect(await moduleScope(gestor, "projetos", "ver")).toBe("todos");
    expect(await moduleScope(gestor, "financeiro", "ver")).toEqual([]);
  });

  it("escopo vazio nunca vira 'tudo'; registro sem projeto só entra em 'todos'", () => {
    expect(scopeAllows([], 1)).toBe(false);
    expect(scopeAllows([MEU], null)).toBe(false);
    expect(scopeAllows([MEU], ALHEIO)).toBe(false);
    expect(scopeAllows([MEU], MEU)).toBe(true);
    expect(scopeAllows("todos", null)).toBe(true);
  });
});

describe("funcionário: consultas das páginas", () => {
  it("lista de projetos e opções de projeto: só os dele (busca pelo nome do alheio não acha nada)", async () => {
    const scope = await moduleScope(funcionario, "projetos", "ver");
    const { rows, total } = await listProjects({}, scope);
    expect(rows.map((row) => row.id).sort()).toEqual([MEU, SO_VER].sort());
    expect(total).toBe(2);
    expect((await listProjects({ q: SECRET }, scope)).rows).toEqual([]);
    expect((await listProjects({ clientId: clientOther }, scope)).rows).toEqual([]);
    expect((await getProjectOptions(null, scope)).map((option) => option.value).sort()).toEqual([MEU, SO_VER].sort());
    // sem membros: nada
    expect((await listProjects({}, [])).rows).toEqual([]);
    // quem vê tudo continua vendo tudo
    expect((await listProjects({}, "todos")).rows.map((row) => row.id)).toEqual(expect.arrayContaining([MEU, SO_VER, ALHEIO]));
  });

  it("tarefas: só as dos projetos dele — nem a do projeto alheio, nem a sem projeto, nem filtrando pelo id alheio", async () => {
    const scope = await moduleScope(funcionario, "tarefas", "ver");
    const ids = (await listTasks({}, scope)).open.map((item) => item.id).sort();
    expect(ids).toEqual([task.mine, task.viewOnly].sort());
    expect((await listTasks({ projectId: ALHEIO }, scope)).open).toEqual([]);
    expect((await listTasks({ clientId: clientOther }, scope)).open).toEqual([]);
    expect(JSON.stringify(await listTasks({}, scope))).not.toContain(SECRET);
    expect((await listTasks({}, "todos")).open.map((item) => item.id)).toEqual(expect.arrayContaining([task.mine, task.other, task.loose]));
  });

  it("visão geral: sem números de financeiro, leads, propostas e clientes; entregas e tarefas só dos projetos dele", async () => {
    const access = await dashboardAccess(funcionario);
    expect(access).toMatchObject({ leads: false, proposals: false, clients: false, finance: false, agenda: false, site: false, admin: false });
    const summary = await getSummary(today, access);
    expect(summary.receivables).toBeNull();
    expect(summary.newLeads).toBeNull();
    expect(summary.proposals).toBeNull();
    expect(summary.activeClients).toBeNull();
    // só o projeto MEU tem prazo (vencido); o ALHEIO, também vencido, não entra na conta
    expect(summary.deliveries).toEqual({ pending: 1, overdue: 1, nextDate: null });
    const issues = await getIssues(today, access);
    expect(issues.overdueDeliveries.items.map((item) => item.id)).toEqual([MEU]);
    expect(issues.overduePayables).toEqual({ total: 0, items: [], totalCents: 0 });
    expect(issues.overdueProposals).toEqual({ total: 0, items: [] });
    const important = await listImportantTasks(today, access.tasks ?? []);
    expect(important.tasks.map((item) => item.id).sort()).toEqual([task.mine, task.viewOnly].sort());
    expect(JSON.stringify({ summary, issues, important })).not.toContain(SECRET);

    // o gestor vê a operação inteira, mas NÃO o financeiro
    const forManager = await dashboardAccess(gestor);
    expect(forManager).toMatchObject({ leads: true, proposals: true, clients: true, finance: false, projects: "todos", tasks: "todos", site: false, admin: false });
    const managerSummary = await getSummary(today, forManager);
    expect(managerSummary.receivables).toBeNull();
    expect(managerSummary.newLeads).toBeGreaterThanOrEqual(1);
    expect((await getIssues(today, forManager)).overduePayables.total).toBe(0);
    // o sócio vê tudo
    expect((await getSummary(today, await dashboardAccess(admin))).receivables?.totalCents).toBeGreaterThanOrEqual(987_654);
  });
});

describe("funcionário: páginas", () => {
  const openProject = (id: number | string) => html(() => ProjectPage({ params: Promise.resolve({ id: String(id) }) }));

  it("detalhe do projeto: abre os dele; o alheio, um id inexistente e um id inválido dão a MESMA resposta", async () => {
    as(funcionario);
    expect(await openProject(ALHEIO)).toBe(NO_ACCESS);
    expect(await openProject(999_999)).toBe(NO_ACCESS);
    expect(await openProject("abc")).toBe(NO_ACCESS);
    expect(await openProject(-1)).toBe(NO_ACCESS);
    expect(await openProject(`${MEU} OR 1=1`)).toBe(NO_ACCESS);

    const mine = await openProject(MEU);
    expect(mine).toContain("[Teste] Projeto MEU");
    expect(mine).toContain("[Teste] tarefa do meu projeto");
    // nada de financeiro, contratos, observações internas, equipe nem links (ele não tem "baixar" neste projeto)
    expect(mine).not.toContain(SECRET);
    expect(mine).not.toContain("987654");
    expect(mine).not.toContain("drive.example");
    expect(mine).not.toContain("financeiro-titulo");
    expect(mine).not.toContain("contratos-titulo");
    expect(mine).not.toContain("excluir-titulo");
    expect(mine).not.toContain("notas-titulo");
    expect(mine).not.toContain("/editar");
    expect(mine).toContain("andamento-titulo"); // pode mudar a etapa (tem "editar" neste projeto)

    const viewOnly = await openProject(SO_VER);
    expect(viewOnly).toContain("[Teste] Projeto SO_VER");
    expect(viewOnly).not.toContain("andamento-titulo");
    expect(viewOnly).not.toContain("drive.example");
    as(null);
  });

  it("o mesmo projeto, para o gestor e para o sócio: gestor sem financeiro; sócio com tudo", async () => {
    as(gestor);
    const forManager = await openProject(MEU);
    expect(forManager).toContain("drive.example/meu");
    expect(forManager).toContain("notas-titulo");
    expect(forManager).not.toContain("financeiro-titulo");
    expect(forManager).not.toContain(`${SECRET}-RECEITA`);
    expect(forManager).not.toContain("excluir-titulo"); // o gestor não exclui projetos
    expect(await openProject(999_999)).toBe("NOT_FOUND");
    as(admin);
    const forAdmin = await openProject(MEU);
    expect(forAdmin).toContain(`${SECRET}-RECEITA`);
    expect(forAdmin).toContain("excluir-titulo");
    expect(await openProject(ALHEIO)).toContain(`${SECRET}-PROJETO-ALHEIO`);
    as(null);
  });

  it("lista de projetos, tarefas e visão geral: nada do projeto alheio aparece, nem com filtros na URL", async () => {
    as(funcionario);
    for (const query of [{}, { vista: "lista" }, { vista: "arquivos" }, { cliente: String(clientOther) }, { q: "ALHEIO" }, { vista: "lista", pagina: "2" }]) {
      const page = await html(() => ProjectsPage({ searchParams: Promise.resolve(query) }));
      expect(page, JSON.stringify(query)).not.toContain(SECRET);
      expect(page).not.toContain("drive.example"); // a visão "Arquivos e entregas" não existe para ele
      expect(page).not.toContain("/painel/projetos/novo");
    }
    for (const query of [{}, { projeto: String(ALHEIO) }, { cliente: String(clientOther) }, { responsavel: String(colega.id) }]) {
      const page = await html(() => TasksPage({ searchParams: Promise.resolve(query) }));
      expect(page, JSON.stringify(query)).not.toContain(SECRET);
      expect(page).toContain("[Teste] tarefa do meu projeto");
    }
    const home = await html(() => HomePage());
    expect(home).not.toContain(SECRET);
    expect(home).not.toContain("987654");
    as(null);
  });
});

describe("funcionário: actions de tarefas (o projeto é lido do BANCO, não do formulário)", () => {
  it("concluir/reabrir: só nas tarefas de projeto em que pode editar", async () => {
    as(funcionario);
    denied(await setTaskDoneAction(task.other, true));
    denied(await setTaskDoneAction(task.viewOnly, true));
    denied(await setTaskDoneAction(task.loose, true));
    denied(await setTaskDoneAction(999_999, true));
    for (const id of [task.other, task.viewOnly, task.loose]) expect((await taskRow(id)).done).toBe(false);
    expect(await setTaskDoneAction(task.mine, true)).toMatchObject({ ok: true });
    expect((await taskRow(task.mine)).done).toBe(true);
    await setTaskDoneAction(task.mine, false);
    as(null);
  });

  it("editar: tarefa alheia não muda; não dá para MOVER uma tarefa para o projeto alheio nem puxar uma de lá", async () => {
    as(funcionario);
    const fields = (id: number, projectId: number | "") => form({ id: String(id), title: "[Teste] alterada pelo funcionário", priority: "normal", projectId: String(projectId), clientId: String(clientOther) });
    // tarefa do projeto alheio (mesmo dizendo no formulário que é do MEU)
    denied(await updateTaskAction(initialActionState, fields(task.other, MEU)));
    expect((await taskRow(task.other)).title).toContain(SECRET);
    // tarefa sem projeto e tarefa de projeto só-ver
    denied(await updateTaskAction(initialActionState, fields(task.loose, MEU)));
    denied(await updateTaskAction(initialActionState, fields(task.viewOnly, MEU)));
    // tarefa dele, mas tentando mandar para o projeto alheio / para fora de qualquer projeto / para o só-ver
    denied(await updateTaskAction(initialActionState, fields(task.mine, ALHEIO)));
    denied(await updateTaskAction(initialActionState, fields(task.mine, "")));
    denied(await updateTaskAction(initialActionState, fields(task.mine, SO_VER)));
    expect((await taskRow(task.mine)).projectId).toBe(MEU);
    // edição legítima: o cliente NÃO vem do formulário (ficou o do projeto, não o alheio que foi enviado)
    expect(await updateTaskAction(initialActionState, fields(task.mine, MEU))).toMatchObject({ ok: true });
    const saved = await taskRow(task.mine);
    expect(saved.title).toBe("[Teste] alterada pelo funcionário");
    expect(saved.clientId).toBe(clientMine);
    // não pode passar a tarefa para outra pessoa
    const toColleague = fields(task.mine, MEU);
    toColleague.set("ownerId", String(colega.id));
    expect(await updateTaskAction(initialActionState, toColleague)).toMatchObject({ ok: false, message: expect.stringMatching(/você mesmo/) });
    as(null);
  });

  it("criar: só em projeto em que pode editar; sem projeto, no alheio e no só-ver é recusado", async () => {
    as(funcionario);
    const create = (projectId: number | "") => createTaskAction(initialActionState, form({ title: `[Teste] criada pelo funcionário ${projectId}`, projectId: String(projectId), clientId: String(clientOther) }));
    const before = (await db.select({ id: tasks.id }).from(tasks)).length;
    denied(await create(ALHEIO));
    denied(await create(SO_VER));
    denied(await create(""));
    denied(await create(999_999));
    expect((await db.select({ id: tasks.id }).from(tasks)).length).toBe(before);
    expect(await create(MEU)).toMatchObject({ ok: true });
    const created = (await db.select().from(tasks).where(eq(tasks.projectId, MEU))).find((row) => row.title.includes("criada pelo funcionário"));
    expect(created).toMatchObject({ projectId: MEU, clientId: clientMine }); // cliente do PROJETO, não o do formulário
    as(null);
  });

  it("excluir: o funcionário não exclui tarefa nenhuma (nem a dele)", async () => {
    as(funcionario);
    expect(await outcome(() => deleteTaskAction(initialActionState, form({ id: String(task.mine) })))).toBe(NO_ACCESS);
    expect(await outcome(() => deleteTaskAction(initialActionState, form({ id: String(task.other) })))).toBe(NO_ACCESS);
    expect(await taskRow(task.mine)).toBeDefined();
    expect(await taskRow(task.other)).toBeDefined();
    as(null);
  });
});

describe("funcionário: actions de projetos", () => {
  it("etapa, quadro, checklist e tarefa rápida: só no projeto em que pode editar", async () => {
    as(funcionario);
    for (const id of [ALHEIO, SO_VER, 999_999]) {
      denied(await updateProjectStageAction(initialActionState, form({ id: String(id), stage: "entregue" })));
      denied(await moveProjectAction(id, "entregue"));
      denied(await addChecklistItemAction(initialActionState, form({ id: String(id), text: "item do funcionário" })));
      denied(await toggleChecklistItemAction(id, "item-alheio", true));
      denied(await removeChecklistItemAction(id, "item-alheio"));
      denied(await addProjectTaskAction(initialActionState, form({ id: String(id), title: "[Teste] tarefa rápida indevida" })));
    }
    const other = await projectRow(ALHEIO);
    expect(other.stage).toBe("gravacao");
    expect(other.checklist).toEqual([{ id: "item-alheio", text: `${SECRET}-ITEM`, done: false }]);
    expect((await projectRow(SO_VER)).stage).toBe("gravacao");
    expect((await db.select().from(tasks).where(inArray(tasks.projectId, [ALHEIO, SO_VER]))).some((row) => row.title.includes("indevida"))).toBe(false);

    // no projeto dele, funciona
    expect(await toggleChecklistItemAction(MEU, "item-meu", true)).toMatchObject({ ok: true });
    expect(await addChecklistItemAction(initialActionState, form({ id: String(MEU), text: "novo item" }))).toMatchObject({ ok: true });
    expect(await updateProjectStageAction(initialActionState, form({ id: String(MEU), stage: "edicao" }))).toMatchObject({ ok: true });
    expect(await addProjectTaskAction(initialActionState, form({ id: String(MEU), title: "[Teste] tarefa rápida" }))).toMatchObject({ ok: true });
    const mine = await projectRow(MEU);
    expect(mine.stage).toBe("edicao");
    expect(mine.checklist).toHaveLength(2);
    expect(mine.checklist[0]).toMatchObject({ id: "item-meu", done: true });
    as(null);
  });

  it("criar, editar o cadastro, excluir e mexer na equipe: nada disso é do funcionário, nem no projeto dele", async () => {
    as(funcionario);
    const calls: (() => Promise<ActionState>)[] = [
      () => createProjectAction(initialActionState, form({ title: "[Teste] projeto indevido" })),
      () => updateProjectAction(initialActionState, form({ id: String(MEU), title: "[Teste] renomeado" })),
      () => deleteProjectAction(initialActionState, form({ id: String(MEU) })),
      () => addProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(funcionario.id), canView: "on", canEdit: "on" })),
      () => updateProjectMemberAction(initialActionState, form({ projectId: String(SO_VER), userId: String(funcionario.id), canView: "on", canEdit: "on", canDownload: "on" })),
      () => removeProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(colega.id) })),
    ];
    for (const call of calls) expect(await outcome(call)).toBe(NO_ACCESS);
    expect((await projectRow(MEU)).title).toBe("[Teste] Projeto MEU");
    // ele não se promoveu: continua só vendo o SO_VER e fora do ALHEIO
    expect(await moduleScope(funcionario, "projetos", "editar")).toEqual([MEU]);
    expect(await moduleScope(funcionario, "projetos", "ver")).toEqual([MEU, SO_VER].sort((a, b) => a - b));
    as(null);
  });
});

describe("equipe do projeto (quem gerencia) e revogação", () => {
  it("o gestor inclui, ajusta e tira pessoas; só contas de funcionário, freelancer ou gestor entram", async () => {
    as(gestor);
    const cliente = await makeAccount("cliente");
    const freelancer = await makeAccount("freelancer");
    // conta de cliente e conta de sócio não entram como equipe
    expect(await addProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(cliente.id), canView: "on" }))).toMatchObject({ ok: false });
    expect(await addProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(admin.id), canView: "on" }))).toMatchObject({ ok: false });
    expect(await addProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(freelancer.id), role: "Drone", canView: "on" }))).toMatchObject({ ok: true });
    // quem já é membro não é "incluído" de novo (mudar o que pode é a outra ação)
    expect(await addProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(freelancer.id), canView: "on", canEdit: "on" }))).toMatchObject({ ok: false });
    const rows = await db.select().from(projectMembers).where(eq(projectMembers.projectId, ALHEIO));
    expect(rows.find((row) => row.userId === freelancer.id)).toMatchObject({ role: "Drone", canView: true, canEdit: false });
    expect(rows.some((row) => row.userId === cliente.id || row.userId === admin.id)).toBe(false);
    expect(await removeProjectMemberAction(initialActionState, form({ projectId: String(ALHEIO), userId: String(freelancer.id) }))).toMatchObject({ ok: true });
    as(null);
  });

  it("dar 'baixar' libera os links; tirar do projeto fecha TUDO na requisição seguinte (página, lista, tarefas, actions)", async () => {
    as(gestor);
    expect(await updateProjectMemberAction(initialActionState, form({ projectId: String(MEU), userId: String(funcionario.id), role: "Editor", canView: "on", canEdit: "on", canDownload: "on" }))).toMatchObject({ ok: true });
    as(funcionario);
    expect(await html(() => ProjectPage({ params: Promise.resolve({ id: String(MEU) }) }))).toContain("drive.example/meu");

    as(gestor);
    expect(await removeProjectMemberAction(initialActionState, form({ projectId: String(MEU), userId: String(funcionario.id) }))).toMatchObject({ ok: true });
    as(funcionario);
    expect(await html(() => ProjectPage({ params: Promise.resolve({ id: String(MEU) }) }))).toBe(NO_ACCESS);
    const scope = await moduleScope(funcionario, "tarefas", "ver");
    expect(scope).toEqual([SO_VER]);
    expect((await listTasks({}, scope)).open.map((item) => item.id)).toEqual([task.viewOnly]);
    denied(await setTaskDoneAction(task.mine, true));
    denied(await updateProjectStageAction(initialActionState, form({ id: String(MEU), stage: "entregue" })));
    expect((await projectRow(MEU)).stage).toBe("edicao");
    // pausar o acesso (desligar "ver") também fecha
    as(gestor);
    await updateProjectMemberAction(initialActionState, form({ projectId: String(SO_VER), userId: String(funcionario.id), canEdit: "on" }));
    as(funcionario);
    expect(await moduleScope(funcionario, "projetos", "ver")).toEqual([]);
    expect(await html(() => ProjectPage({ params: Promise.resolve({ id: String(SO_VER) }) }))).toBe(NO_ACCESS);
    expect(await html(() => TasksPage({ searchParams: Promise.resolve({}) }))).not.toContain("[Teste] tarefa");
    as(null);
  });
});
