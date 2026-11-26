/**
 * ISOLAMENTO POR PROJETO E POR CLIENTE, no banco de teste: "um usuário não pode acessar dados de outro por
 * mudança de URL ou identificador" (briefing v2, seções 28 e 32).
 *
 * Cenário: dois clientes (A e B) com projetos; funcionário e freelancer escalados em projetos diferentes; contas
 * de cliente vinculadas a A e a B. Todos os registros internos carregam textos-sentinela ("SEGREDO-…"): nenhum
 * deles pode aparecer em nada que as funções de escopo devolvem a um perfil externo.
 */
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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

import { db } from "@/db";
import { clients, clientUsers, financeEntries, projectMembers, projects, tasks } from "@/db/schema";
import { updateUser } from "@/server/config/users";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import { requireProjectAccess, requireProjectPermission } from "./guards";
import { linkClientUser, listClientUsers, listProjectMembers, removeProjectMember, setProjectMember, unlinkClientUser } from "./members";
import { getClientProjectView, getTeamProjectView, listClientProjectViews, listTeamProjectViews } from "./projects";
import { canAccessProject, canInProject, clientScope, clientScopeFilter, inScope, PROJECT_ACTIONS, projectScope, projectScopeFilter } from "./scope";

const SECRET = "SEGREDO";
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";

type Role = "admin" | "socio" | "gestor" | "tecnico" | "funcA" | "funcB" | "freeA" | "freeB" | "freeNone" | "cliA" | "cliB" | "cliNone";
const who = {} as Record<Role, TestAccount>;
let clientA = 0;
let clientB = 0;
/** PA1 e PA2 são do cliente A; PB1 do cliente B; PX não tem cliente. */
let PA1 = 0;
let PA2 = 0;
let PB1 = 0;
let PX = 0;
const taskIds: number[] = [];

beforeAll(async () => {
  const insertedClients = await db
    .insert(clients)
    .values([
      { name: "[Teste] Cliente A", notes: `${SECRET}-NOTA-CLIENTE-A`, document: "111.111.111-11" },
      { name: "[Teste] Cliente B", notes: `${SECRET}-NOTA-CLIENTE-B`, document: "222.222.222-22" },
    ])
    .returning({ id: clients.id });
  [clientA, clientB] = insertedClients.map((row) => row.id);

  const project = (title: string, clientId: number | null) => ({
    title: `[Teste] ${title}`,
    clientId,
    notes: `${SECRET}-NOTA-INTERNA-${title}`,
    backupNote: `${SECRET}-BACKUP-${title}`,
    driveUrl: `https://drive.example/${SECRET}-DRIVE-${title}`,
    finalFilesUrl: `https://drive.example/${SECRET}-FINAIS-${title}`,
    galleryUrl: `https://galeria.example/${SECRET}-GALERIA-${title}`,
    referencesUrl: `https://referencias.example/${title}`,
    location: `Local ${title}`,
    proposalId: 987654,
    checklist: [{ id: "a", text: `Item ${title}`, done: false }],
  });
  const insertedProjects = await db
    .insert(projects)
    .values([project("PA1", clientA), project("PA2", clientA), project("PB1", clientB), project("PX", null)])
    .returning({ id: projects.id });
  [PA1, PA2, PB1, PX] = insertedProjects.map((row) => row.id);

  await db.insert(financeEntries).values(
    [PA1, PB1].map((projectId) => ({
      type: "despesa" as const,
      category: "freelancer" as const,
      description: `${SECRET}-CACHE-DE-OUTRO-PROFISSIONAL-${projectId}`,
      amountCents: 123456,
      dueDate: "2026-12-01",
      projectId,
    })),
  );
  const insertedTasks = await db
    .insert(tasks)
    .values([
      { title: "[Teste] tarefa PA1", projectId: PA1 },
      { title: "[Teste] tarefa PA2", projectId: PA2 },
      { title: "[Teste] tarefa PB1", projectId: PB1 },
      { title: "[Teste] tarefa sem projeto", projectId: null },
    ])
    .returning({ id: tasks.id });
  taskIds.push(...insertedTasks.map((row) => row.id));

  who.admin = await makeAccount("admin");
  who.socio = await makeAccount("socio");
  who.gestor = await makeAccount("gestor");
  who.tecnico = await makeAccount("tecnico");
  who.funcA = await makeAccount("funcionario");
  who.funcB = await makeAccount("funcionario");
  who.freeA = await makeAccount("freelancer");
  who.freeB = await makeAccount("freelancer");
  who.freeNone = await makeAccount("freelancer");
  who.cliA = await makeAccount("cliente");
  who.cliB = await makeAccount("cliente");
  who.cliNone = await makeAccount("cliente");

  const ok = async (result: Promise<{ ok: boolean }>) => expect((await result).ok).toBe(true);
  await ok(setProjectMember(PA1, who.funcA.id, { role: "Editor", canEdit: true }, who.admin));
  await ok(setProjectMember(PB1, who.funcB.id, { role: `${SECRET}-PAPEL-DO-COLEGA` }, who.admin));
  await ok(setProjectMember(PA1, who.freeA.id, { role: "Fotógrafo", canUpload: true }, who.admin));
  await ok(setProjectMember(PB1, who.freeB.id, { role: "Filmmaker", canDownload: true }, who.admin));
  await ok(linkClientUser(clientA, who.cliA.id, who.admin));
  await ok(linkClientUser(clientB, who.cliB.id, who.admin));
});

afterAll(async () => {
  await db.delete(financeEntries).where(inArray(financeEntries.projectId, [PA1, PA2, PB1, PX]));
  await db.delete(tasks).where(inArray(tasks.id, taskIds));
  await db.delete(projects).where(inArray(projects.id, [PA1, PA2, PB1, PX]));
  await db.delete(clients).where(inArray(clients.id, [clientA, clientB]));
  await removeAccounts();
});

describe("projectScope: quais projetos cada um enxerga", () => {
  it("admin, sócio, gestor e técnico: todos", async () => {
    for (const role of ["admin", "socio", "gestor", "tecnico"] as const) expect(await projectScope(who[role]), role).toBe("todos");
  });

  it("funcionário e freelancer: só os projetos em que são membros", async () => {
    expect(await projectScope(who.funcA)).toEqual([PA1]);
    expect(await projectScope(who.funcB)).toEqual([PB1]);
    expect(await projectScope(who.freeA)).toEqual([PA1]);
    expect(await projectScope(who.freeB)).toEqual([PB1]);
    expect(await projectScope(who.freeNone)).toEqual([]);
  });

  it("cliente: só os projetos dos clientes a que a conta está vinculada", async () => {
    expect(await projectScope(who.cliA)).toEqual([PA1, PA2].sort((a, b) => a - b));
    expect(await projectScope(who.cliB)).toEqual([PB1]);
    expect(await projectScope(who.cliNone)).toEqual([]);
  });

  it("um gestor com 'ver projetos' negado deixa de ver todos", async () => {
    expect(await projectScope({ ...who.gestor, permissions: { grant: [], deny: ["projetos:ver"] } })).toEqual([]);
  });
});

describe("clientScope: quais fichas de cliente cada um alcança", () => {
  it("quem vê clientes no painel: todas; conta de cliente: só as vinculadas; equipe de projeto: nenhuma", async () => {
    for (const role of ["admin", "socio", "gestor", "tecnico"] as const) expect(await clientScope(who[role]), role).toBe("todos");
    expect(await clientScope(who.cliA)).toEqual([clientA]);
    expect(await clientScope(who.cliB)).toEqual([clientB]);
    expect(await clientScope(who.cliNone)).toEqual([]);
    for (const role of ["funcA", "freeA", "freeNone"] as const) expect(await clientScope(who[role]), role).toEqual([]);
  });
});

describe("canAccessProject: trocar o id não abre o projeto de outro", () => {
  it("freelancer A vê o projeto dele e NENHUM outro (de B, do mesmo cliente, sem cliente, inexistente, id inválido)", async () => {
    expect(await canAccessProject(who.freeA, PA1, "ver")).toBe(true);
    for (const id of [PB1, PA2, PX, 99_999_999, 0, -1, 1.5, Number.NaN]) expect(await canAccessProject(who.freeA, id, "ver"), String(id)).toBe(false);
    expect(await canAccessProject(who.freeA, String(PA1) as unknown as number, "ver")).toBe(false);
  });

  it("freelancer B não vê o projeto de A, e vice-versa — em nenhuma ação", async () => {
    for (const action of PROJECT_ACTIONS) {
      expect(await canAccessProject(who.freeB, PA1, action), `B→PA1 ${action}`).toBe(false);
      expect(await canAccessProject(who.freeA, PB1, action), `A→PB1 ${action}`).toBe(false);
      expect(await canAccessProject(who.freeNone, PA1, action)).toBe(false);
    }
  });

  it("o membro só faz o que a participação dele permite", async () => {
    // freeA: ver + enviar · freeB: ver + baixar · funcA: ver + editar · funcB: só ver
    expect(await Promise.all(PROJECT_ACTIONS.map((action) => canAccessProject(who.freeA, PA1, action)))).toEqual([true, false, false, true]);
    expect(await Promise.all(PROJECT_ACTIONS.map((action) => canAccessProject(who.freeB, PB1, action)))).toEqual([true, false, true, false]);
    expect(await Promise.all(PROJECT_ACTIONS.map((action) => canAccessProject(who.funcA, PA1, action)))).toEqual([true, true, false, false]);
    expect(await Promise.all(PROJECT_ACTIONS.map((action) => canAccessProject(who.funcB, PB1, action)))).toEqual([true, false, false, false]);
  });

  it("sem 'ver', nenhuma outra permissão do membro vale", async () => {
    const hidden = await makeAccount("freelancer");
    await setProjectMember(PA2, hidden.id, { canView: false, canEdit: true, canDownload: true, canUpload: true }, who.admin);
    for (const action of PROJECT_ACTIONS) expect(await canAccessProject(hidden, PA2, action), action).toBe(false);
    expect(await projectScope(hidden)).toEqual([]);
  });

  it("cliente A vê os projetos do cliente A e nenhum outro; e só VÊ", async () => {
    expect(await canAccessProject(who.cliA, PA1, "ver")).toBe(true);
    expect(await canAccessProject(who.cliA, PA2, "ver")).toBe(true);
    for (const id of [PB1, PX, 99_999_999]) expect(await canAccessProject(who.cliA, id, "ver"), String(id)).toBe(false);
    for (const action of ["editar", "baixar", "enviar"] as const) expect(await canAccessProject(who.cliA, PA1, action), action).toBe(false);
    expect(await canAccessProject(who.cliB, PA1, "ver")).toBe(false);
    expect(await canAccessProject(who.cliNone, PA1, "ver")).toBe(false);
  });

  it("perfis com visão geral acessam qualquer projeto que EXISTA", async () => {
    for (const role of ["admin", "socio", "gestor", "tecnico"] as const) {
      for (const id of [PA1, PB1, PX]) for (const action of PROJECT_ACTIONS) expect(await canAccessProject(who[role], id, action), `${role} ${action}`).toBe(true);
      expect(await canAccessProject(who[role], 99_999_999, "ver")).toBe(false);
    }
  });

  it("vínculo do perfil errado não vale: conta de cliente não é 'membro'; freelancer não herda ficha de cliente", async () => {
    // linhas gravadas direto no banco, por fora das funções que validam o perfil
    await db.insert(projectMembers).values({ projectId: PB1, userId: who.cliA.id, canView: true, canEdit: true, canDownload: true, canUpload: true });
    await db.insert(clientUsers).values({ clientId: clientB, userId: who.freeA.id });
    try {
      for (const action of PROJECT_ACTIONS) expect(await canAccessProject(who.cliA, PB1, action), action).toBe(false);
      expect(await projectScope(who.cliA)).not.toContain(PB1);
      expect(await canAccessProject(who.freeA, PB1, "ver")).toBe(false);
      expect(await projectScope(who.freeA)).toEqual([PA1]);
      expect(await clientScope(who.freeA)).toEqual([]);
    } finally {
      await db.delete(projectMembers).where(and(eq(projectMembers.projectId, PB1), eq(projectMembers.userId, who.cliA.id)));
      await db.delete(clientUsers).where(and(eq(clientUsers.clientId, clientB), eq(clientUsers.userId, who.freeA.id)));
    }
  });
});

describe("canInProject: permissão de módulo aplicada a um projeto (painel)", () => {
  it("funcionário: só nos projetos em que está, só o que a participação permite, nunca excluir/compartilhar", async () => {
    expect(await canInProject(who.funcA, "tarefas", "ver", PA1)).toBe(true);
    expect(await canInProject(who.funcA, "tarefas", "editar", PA1)).toBe(true);
    expect(await canInProject(who.funcA, "tarefas", "baixar", PA1)).toBe(false); // participação sem "baixar"
    expect(await canInProject(who.funcA, "tarefas", "excluir", PA1)).toBe(false);
    expect(await canInProject(who.funcA, "arquivos", "compartilhar", PA1)).toBe(false);
    for (const id of [PB1, PA2, PX, null, undefined, 99_999_999]) expect(await canInProject(who.funcA, "tarefas", "ver", id), String(id)).toBe(false);
    // funcB só vê
    expect(await canInProject(who.funcB, "conteudo", "ver", PB1)).toBe(true);
    expect(await canInProject(who.funcB, "conteudo", "editar", PB1)).toBe(false);
  });

  it("ser membro não dá módulo que o perfil não tem (financeiro, clientes, propostas…)", async () => {
    for (const mod of ["financeiro", "clientes", "propostas", "contratos", "leads", "equipe", "dados"] as const) {
      expect(await canInProject(who.funcA, mod, "ver", PA1), mod).toBe(false);
    }
  });

  it("freelancer e cliente: nada pelo painel, nem no próprio projeto", async () => {
    for (const mod of ["projetos", "tarefas", "arquivos", "financeiro"] as const) {
      expect(await canInProject(who.freeA, mod, "ver", PA1), mod).toBe(false);
      expect(await canInProject(who.cliA, mod, "ver", PA1), mod).toBe(false);
    }
  });

  it("quem tem o módulo inteiro não depende de ser membro", async () => {
    expect(await canInProject(who.gestor, "tarefas", "editar", PB1)).toBe(true);
    expect(await canInProject(who.gestor, "tarefas", "editar", null)).toBe(true);
    expect(await canInProject(who.gestor, "financeiro", "ver", PB1)).toBe(false);
    expect(await canInProject(who.tecnico, "financeiro", "ver", PB1)).toBe(true);
  });
});

describe("inScope: o filtro aplicado em consultas de lista", () => {
  const titles = async (filter: ReturnType<typeof inScope>) =>
    (await db.select({ title: tasks.title }).from(tasks).where(and(inArray(tasks.id, taskIds), filter))).map((row) => row.title).sort();

  it("lista de tarefas: cada um recebe só as dos seus projetos", async () => {
    expect(await titles(await projectScopeFilter(who.funcA, tasks.projectId))).toEqual(["[Teste] tarefa PA1"]);
    expect(await titles(await projectScopeFilter(who.freeB, tasks.projectId))).toEqual(["[Teste] tarefa PB1"]);
    expect(await titles(await projectScopeFilter(who.cliA, tasks.projectId))).toEqual(["[Teste] tarefa PA1", "[Teste] tarefa PA2"]);
  });

  it("escopo VAZIO filtra tudo (nunca vira 'sem filtro')", async () => {
    expect(await titles(await projectScopeFilter(who.freeNone, tasks.projectId))).toEqual([]);
    expect(await titles(await projectScopeFilter(who.cliNone, tasks.projectId))).toEqual([]);
    expect(await titles(inScope(tasks.projectId, []))).toEqual([]);
  });

  it("'todos' não filtra; registros sem projeto só aparecem para quem vê tudo", async () => {
    expect(await projectScopeFilter(who.gestor, tasks.projectId)).toBeUndefined();
    expect(await titles(await projectScopeFilter(who.gestor, tasks.projectId))).toHaveLength(4);
    expect(await titles(await projectScopeFilter(who.funcA, tasks.projectId))).not.toContain("[Teste] tarefa sem projeto");
  });

  it("escopo de clientes numa consulta de projetos", async () => {
    const ids = async (role: Role) =>
      (await db.select({ id: projects.id }).from(projects).where(and(inArray(projects.id, [PA1, PA2, PB1, PX]), await clientScopeFilter(who[role])))).map((row) => row.id).sort((a, b) => a - b);
    expect(await ids("cliA")).toEqual([PA1, PA2].sort((a, b) => a - b));
    expect(await ids("cliB")).toEqual([PB1]);
    expect(await ids("cliNone")).toEqual([]);
    expect(await ids("freeA")).toEqual([]);
    expect(await ids("admin")).toHaveLength(4);
  });
});

describe("o que um perfil externo consegue LER de um projeto", () => {
  it("equipe: só os campos permitidos, do próprio projeto, com a própria participação", async () => {
    const view = await getTeamProjectView(who.freeA, PA1);
    expect(Object.keys(view ?? {}).sort()).toEqual(
      ["checklist", "deliveryDeadline", "eventDate", "id", "location", "membership", "referencesUrl", "serviceType", "shootDeadline", "stage", "title"].sort(),
    );
    expect(view?.membership).toEqual({ role: "Fotógrafo", canEdit: false, canDownload: false, canUpload: true });
    expect(await getTeamProjectView(who.freeA, PB1)).toBeNull();
    expect(await getTeamProjectView(who.freeA, PA2)).toBeNull();
    expect(await getTeamProjectView(who.freeA, 99_999_999)).toBeNull();
    expect(await getTeamProjectView(who.freeNone, PA1)).toBeNull();
    expect(await getTeamProjectView(who.cliA, PA1)).toBeNull(); // conta de cliente não usa a visão da equipe
    expect((await listTeamProjectViews(who.freeA)).map((item) => item.id)).toEqual([PA1]);
    expect(await listTeamProjectViews(who.freeNone)).toEqual([]);
  });

  it("cliente: só os campos permitidos, só dos clientes vinculados", async () => {
    const view = await getClientProjectView(who.cliA, PA1);
    expect(Object.keys(view ?? {}).sort()).toEqual(["deliveredAt", "deliveryDeadline", "eventDate", "id", "location", "serviceType", "stage", "title"].sort());
    expect(await getClientProjectView(who.cliA, PB1)).toBeNull();
    expect(await getClientProjectView(who.cliA, PX)).toBeNull();
    expect(await getClientProjectView(who.cliB, PA1)).toBeNull();
    expect(await getClientProjectView(who.cliNone, PA1)).toBeNull();
    expect(await getClientProjectView(who.freeA, PA1)).toBeNull(); // nem a equipe do projeto usa a visão do cliente
    expect(await getClientProjectView(who.admin, PA1)).toBeNull();
    expect((await listClientProjectViews(who.cliA)).map((item) => item.id).sort((a, b) => a - b)).toEqual([PA1, PA2].sort((a, b) => a - b));
    expect(await listClientProjectViews(who.cliNone)).toEqual([]);
    expect(await listClientProjectViews(who.admin)).toEqual([]);
  });

  it("NADA interno vaza: notas, backup, links de trabalho, proposta, financeiro, papel e dados de colegas, outro cliente", async () => {
    for (const role of ["freeA", "freeB", "freeNone", "funcA", "cliA", "cliB", "cliNone"] as const) {
      const user = who[role];
      // tudo o que as funções de acesso devolvem para esta pessoa, de qualquer projeto, pedindo com qualquer id
      const everything = JSON.stringify([
        await projectScope(user),
        await clientScope(user),
        await listTeamProjectViews(user),
        await listClientProjectViews(user),
        await Promise.all([PA1, PA2, PB1, PX].map((id) => getTeamProjectView(user, id))),
        await Promise.all([PA1, PA2, PB1, PX].map((id) => getClientProjectView(user, id))),
        await Promise.all([PA1, PA2, PB1, PX].flatMap((id) => PROJECT_ACTIONS.map((action) => canAccessProject(user, id, action)))),
      ]);
      expect(everything, role).not.toContain(SECRET);
      for (const forbidden of ["notes", "backup", "driveUrl", "finalFilesUrl", "galleryUrl", "proposalId", "ownerId", "amountCents", "987654", "123456", "passwordHash", "document"]) {
        expect(everything, `${role}: ${forbidden}`).not.toContain(forbidden);
      }
      // nada sobre as OUTRAS contas (nomes e e-mails de teste dos colegas e dos outros clientes)
      for (const other of Object.values(who)) {
        if (other.id === user.id) continue;
        expect(everything).not.toContain(other.email);
        expect(everything).not.toContain(other.name);
      }
    }
  });

  it("o cliente A não recebe NADA do cliente B (e vice-versa)", async () => {
    const seenByA = JSON.stringify([await listClientProjectViews(who.cliA), await projectScope(who.cliA), await clientScope(who.cliA)]);
    expect(seenByA).not.toContain("PB1");
    expect(seenByA).not.toContain("Cliente B");
    const seenByB = JSON.stringify(await listClientProjectViews(who.cliB));
    expect(seenByB).not.toContain("PA1");
    expect(seenByB).not.toContain("PA2");
  });
});

describe("guardas com projeto (página/ação de detalhe)", () => {
  it("Área da Equipe: projeto alheio e projeto inexistente respondem IGUAL (404)", async () => {
    browser.token = who.freeA.token;
    expect(((await requireProjectAccess("equipe", PA1)) as { id: number }).id).toBe(who.freeA.id);
    expect(await outcome(() => requireProjectAccess("equipe", PB1))).toBe("NOT_FOUND");
    expect(await outcome(() => requireProjectAccess("equipe", 99_999_999))).toBe("NOT_FOUND");
    expect(await outcome(() => requireProjectAccess("equipe", PA1, "editar"))).toBe("NOT_FOUND");
    expect(((await requireProjectAccess("equipe", PA1, "enviar")) as { id: number }).id).toBe(who.freeA.id);
  });

  it("Área do Cliente: só os projetos dos clientes vinculados", async () => {
    browser.token = who.cliA.token;
    expect(((await requireProjectAccess("cliente", PA2)) as { id: number }).id).toBe(who.cliA.id);
    expect(await outcome(() => requireProjectAccess("cliente", PB1))).toBe("NOT_FOUND");
    expect(await outcome(() => requireProjectAccess("cliente", PA1, "baixar"))).toBe("NOT_FOUND");
    // o ambiente errado nem chega a olhar o projeto
    expect(await outcome(() => requireProjectAccess("equipe", PA1))).toBe(NO_ACCESS);
    browser.token = who.freeA.token;
    expect(await outcome(() => requireProjectAccess("cliente", PA1))).toBe(NO_ACCESS);
  });

  it("painel: requireProjectPermission junta a matriz com a participação no projeto", async () => {
    browser.token = who.funcA.token;
    expect(((await requireProjectPermission("tarefas", "editar", PA1)) as { id: number }).id).toBe(who.funcA.id);
    expect(await outcome(() => requireProjectPermission("tarefas", "editar", PB1))).toBe(NO_ACCESS);
    expect(await outcome(() => requireProjectPermission("tarefas", "excluir", PA1))).toBe(NO_ACCESS);
    expect(await outcome(() => requireProjectPermission("financeiro", "ver", PA1))).toBe(NO_ACCESS);
    browser.token = who.freeA.token;
    expect(await outcome(() => requireProjectPermission("tarefas", "ver", PA1))).toBe(NO_ACCESS); // freelancer não entra no painel
    browser.token = who.gestor.token;
    expect(((await requireProjectPermission("tarefas", "editar", PB1)) as { id: number }).id).toBe(who.gestor.id);
    browser.token = null;
    expect(await outcome(() => requireProjectPermission("tarefas", "ver", PA1))).toBe("REDIRECT:/login");
  });
});

describe("vínculos: regras e revogação", () => {
  it("conta de cliente não vira membro de equipe; só conta de cliente é vinculada a uma ficha", async () => {
    expect(await setProjectMember(PA1, who.cliA.id, {}, who.admin)).toEqual({ ok: false, error: "role_not_allowed" });
    expect(await linkClientUser(clientA, who.freeA.id, who.admin)).toEqual({ ok: false, error: "role_not_allowed" });
    expect(await linkClientUser(clientA, who.gestor.id, who.admin)).toEqual({ ok: false, error: "role_not_allowed" });
    expect(await setProjectMember(99_999_999, who.freeA.id, {}, who.admin)).toEqual({ ok: false, error: "project_not_found" });
    expect(await setProjectMember(PA1, 99_999_999, {}, who.admin)).toEqual({ ok: false, error: "user_not_found" });
    expect(await linkClientUser(99_999_999, who.cliA.id, who.admin)).toEqual({ ok: false, error: "client_not_found" });
    expect(await setProjectMember(PA1, who.freeA.id, { role: "x".repeat(61) }, who.admin)).toEqual({ ok: false, error: "invalid" });
    const inactive = await makeAccount("freelancer", { active: false });
    expect(await setProjectMember(PA1, inactive.id, {}, who.admin)).toEqual({ ok: false, error: "user_not_found" });
  });

  it("incluir de novo atualiza a participação (uma linha por projeto + pessoa)", async () => {
    const account = await makeAccount("freelancer");
    await setProjectMember(PA2, account.id, { role: "Assistente" }, who.admin);
    expect(await canAccessProject(account, PA2, "enviar")).toBe(false);
    await setProjectMember(PA2, account.id, { role: "Assistente", canUpload: true }, who.admin);
    expect(await canAccessProject(account, PA2, "enviar")).toBe(true);
    expect((await listProjectMembers(PA2)).filter((member) => member.userId === account.id)).toHaveLength(1);
    await linkClientUser(clientA, who.cliA.id, who.admin); // repetir o vínculo não duplica
    expect((await listClientUsers(clientA)).filter((row) => row.userId === who.cliA.id)).toHaveLength(1);
  });

  it("REVOGAR vale na hora: tirar do projeto, desvincular do cliente, excluir o projeto", async () => {
    const freelancer = await makeAccount("freelancer");
    const customer = await makeAccount("cliente");
    const [temp] = await db.insert(projects).values({ title: "[Teste] temporário", clientId: clientB }).returning({ id: projects.id });
    await setProjectMember(temp.id, freelancer.id, { canUpload: true }, who.admin);
    await linkClientUser(clientB, customer.id, who.admin);
    expect(await canAccessProject(freelancer, temp.id, "ver")).toBe(true);
    expect(await canAccessProject(customer, temp.id, "ver")).toBe(true);

    expect(await removeProjectMember(temp.id, freelancer.id, who.admin)).toBe(true);
    expect(await removeProjectMember(temp.id, freelancer.id, who.admin)).toBe(false);
    expect(await canAccessProject(freelancer, temp.id, "ver")).toBe(false);
    expect(await projectScope(freelancer)).toEqual([]);

    expect(await unlinkClientUser(clientB, customer.id, who.admin)).toBe(true);
    expect(await canAccessProject(customer, temp.id, "ver")).toBe(false);
    expect(await projectScope(customer)).toEqual([]);

    await setProjectMember(temp.id, freelancer.id, {}, who.admin);
    await db.delete(projects).where(eq(projects.id, temp.id));
    expect(await projectScope(freelancer)).toEqual([]);
    expect(await db.select().from(projectMembers).where(eq(projectMembers.projectId, temp.id))).toHaveLength(0);
  });

  it("mudar o perfil apaga os vínculos que não combinam com o perfil novo", async () => {
    const account = await makeAccount("freelancer");
    await setProjectMember(PA2, account.id, { canEdit: true }, who.admin);
    await updateUser(account.id, { name: account.name, email: account.email, role: "cliente" });
    expect(await db.select().from(projectMembers).where(eq(projectMembers.userId, account.id))).toHaveLength(0);
    await linkClientUser(clientA, account.id, who.admin);
    expect(await projectScope({ ...account, role: "cliente" })).toContain(PA1);
    await updateUser(account.id, { name: account.name, email: account.email, role: "freelancer" });
    expect(await db.select().from(clientUsers).where(eq(clientUsers.userId, account.id))).toHaveLength(0);
    expect(await projectScope({ ...account, role: "freelancer" })).toEqual([]);
  });
});
