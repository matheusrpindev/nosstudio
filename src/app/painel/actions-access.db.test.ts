/**
 * TODAS as Server Actions do painel, chamadas de verdade com sessões de cada perfil (banco de teste):
 * - freelancer e cliente não executam NENHUMA;
 * - o funcionário (permissão só "nos projetos em que está") só passa do guarda nas ações de ANDAMENTO de projeto
 *   e de tarefas — e nelas o projeto do registro é conferido no banco (funcionario-scope.db.test.ts);
 * - o gestor não executa nada de financeiro, site, configurações e usuários;
 * - o técnico não gerencia usuários.
 * O teste varre os arquivos `actions.ts`: uma action nova entra sozinha na conferência.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
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

import { db } from "@/db";
import { clients, financeEntries, users } from "@/db/schema";
import { initialActionState } from "@/lib/action-state";
import type { UserRole } from "@/lib/domain";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";

const ROOT = path.join(process.cwd(), "src/app/painel");
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";

/** Ações da PRÓPRIA CONTA (valem em qualquer ambiente): não são barradas por perfil. */
const ACCOUNT_ACTIONS = new Set(["conta/actions.ts#endOtherSessionsAction"]);
/** Ações de QUALQUER conta do painel (`requirePanelUser`): só alcançam o que é da própria pessoa (as notificações dela). */
const PANEL_WIDE_ACTIONS = new Set(["notificacoes/actions.ts#markAllNotificationsReadAction", "notificacoes/actions.ts#markNotificationReadAction"]);

function actionFiles(dir = ROOT): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return actionFiles(full);
    return entry.name === "actions.ts" ? [full] : [];
  });
}

type Action = { key: string; file: string; name: string; run: (...args: unknown[]) => Promise<unknown> };
const actions: Action[] = [];
const accounts = {} as Record<UserRole, TestAccount>;

beforeAll(async () => {
  for (const file of actionFiles()) {
    const relative = path.relative(ROOT, file).split(path.sep).join("/");
    const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value === "function") actions.push({ key: `${relative}#${name}`, file: relative, name, run: value as Action["run"] });
    }
  }
  for (const role of ["admin", "socio", "tecnico", "gestor", "funcionario", "freelancer", "cliente"] as const) accounts[role] = await makeAccount(role);
});
afterAll(removeAccounts);

/**
 * Chama a action como o formulário chamaria (estado anterior + FormData vazio): o guarda roda antes de tudo.
 * Para quem PASSA do guarda, o formulário vazio para na validação (zod) — nada é gravado.
 */
const call = (action: Action) => outcome(() => action.run(initialActionState, new FormData()));

async function deniedFor(role: UserRole, list: Action[]): Promise<string[]> {
  browser.token = accounts[role].token;
  const passed: string[] = [];
  for (const action of list) if ((await call(action)) !== NO_ACCESS) passed.push(action.key);
  browser.token = null;
  return passed;
}

describe("Server Actions do painel × perfis", () => {
  it("a varredura achou as actions de todos os módulos", () => {
    expect(actions.length).toBeGreaterThan(90);
    const folders = new Set(actions.map((action) => action.file.split("/")[0]));
    for (const folder of ["agenda", "clientes", "config", "conteudo", "contratos", "financeiro", "leads", "marca", "orcamentos", "projetos", "site", "tarefas"]) {
      expect(folders, folder).toContain(folder);
    }
  });

  it("nenhum arquivo de actions exporta algo sem guarda: toda função exportada começa por um `require…`", () => {
    const unguarded: string[] = [];
    for (const file of actionFiles()) {
      const source = readFileSync(file, "utf8");
      const chunks = source.split(/^export async function /m).slice(1);
      for (const chunk of chunks) {
        const name = chunk.slice(0, chunk.indexOf("("));
        const body = chunk.slice(chunk.indexOf("{"));
        const firstAwait = /await\s+(\w+)\(/.exec(body)?.[1] ?? "";
        if (!/^require(Permission|ScopedPermission|Admin|User|SessionUser|PanelUser)$/.test(firstAwait)) unguarded.push(`${path.relative(ROOT, file)}#${name} (${firstAwait || "nenhum await"})`);
      }
    }
    expect(unguarded).toEqual([]);
  });

  it("fora da demonstração do kit, nenhuma action usa o guarda genérico `requireUser()` — todas declaram módulo e ação", () => {
    const generic = actionFiles()
      .filter((file) => !file.includes(`${path.sep}kit${path.sep}`))
      .filter((file) => /await requireUser\(/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));
    expect(generic).toEqual([]);
  });

  it("sem sessão: toda action manda para o login", async () => {
    browser.token = null;
    for (const action of actions) expect(await call(action), action.key).toBe("REDIRECT:/login");
  });

  it("FREELANCER e CLIENTE: nenhuma action do painel executa", async () => {
    const panelActions = actions.filter((action) => !ACCOUNT_ACTIONS.has(action.key));
    expect(await deniedFor("freelancer", panelActions)).toEqual([]);
    expect(await deniedFor("cliente", panelActions)).toEqual([]);
  });

  it("FUNCIONÁRIO: só passam do guarda as ações de andamento de projeto, de tarefas e da agenda — a lista é fechada", async () => {
    // Estas (e só estas) aceitam quem tem a permissão "nos projetos em que está". Com o formulário vazio elas
    // param na validação; com dados de verdade, conferem o projeto do registro no banco — ver
    // funcionario-scope.db.test.ts (projeto alheio, inexistente, só-ver, tarefa sem projeto).
    const PROJECT_SCOPED = [
      "projetos/actions.ts#addChecklistItemAction",
      "projetos/actions.ts#addProjectTaskAction",
      "projetos/actions.ts#moveProjectAction",
      "projetos/actions.ts#removeChecklistItemAction",
      "projetos/actions.ts#toggleChecklistItemAction",
      "projetos/actions.ts#updateProjectStageAction",
      "tarefas/actions.ts#createTaskAction",
      "tarefas/actions.ts#setTaskDoneAction",
      "tarefas/actions.ts#updateTaskAction",
    ];
    // Agenda: o funcionário cria e altera OS PRÓPRIOS compromissos (o que ele alcança vem de `agendaAccess`) —
    // ver src/server/agenda/funcionario.db.test.ts (compromisso alheio, particular alheio, projeto alheio).
    // Excluir (`deleteEventAction`) e as configurações da agenda continuam só para o módulo inteiro.
    const AGENDA_SCOPED = [
      "agenda/actions.ts#blockPeriodAction",
      "agenda/actions.ts#createEventAction",
      "agenda/actions.ts#duplicateEventAction",
      "agenda/actions.ts#ensureCalendarsAction",
      "agenda/actions.ts#moveEventAction",
      "agenda/actions.ts#quickCreateEventAction",
      "agenda/actions.ts#rescheduleEventAction",
      "agenda/actions.ts#setEventStatusAction",
      "agenda/actions.ts#toggleChecklistItemAction",
      "agenda/actions.ts#undoMoveEventAction",
      "agenda/actions.ts#updateEventAction",
    ];
    const passed = await deniedFor("funcionario", actions.filter((action) => !ACCOUNT_ACTIONS.has(action.key) && !PANEL_WIDE_ACTIONS.has(action.key)));
    expect(passed.sort()).toEqual([...AGENDA_SCOPED, ...PROJECT_SCOPED].sort());
    // …e no código, cada uma delas usa o guarda com escopo E confere o escopo antes de gravar
    const bodyOf = (key: string) => {
      const [file, name] = key.split("#");
      const source = readFileSync(path.join(ROOT, file), "utf8");
      return source.slice(source.indexOf(`export async function ${name}(`)).split(/^export async function /m)[1];
    };
    for (const key of PROJECT_SCOPED) {
      expect(bodyOf(key), key).toMatch(/await requireScopedPermission\(/);
      expect(bodyOf(key), key).toMatch(/scopeAllows\(|restrictedRefs\(/);
    }
    for (const key of AGENDA_SCOPED) {
      expect(bodyOf(key), key).toMatch(/await requireScopedPermission\("agenda", "editar"\)/);
      // só cria agendas pessoais que faltam (idempotente, sem dados de ninguém): não lê nem altera compromisso
      if (key.endsWith("#ensureCalendarsAction")) continue;
      expect(bodyOf(key), key).toMatch(/await agendaAccess\(user\)/);
      expect(bodyOf(key), key).toMatch(/getMutableEvent\(access, |restrictEventInput\(access, |undoMove\(access, |access\.edit !== "todos"/);
    }
  });

  it("as ações de notificação valem para qualquer conta do painel — e para mais ninguém", async () => {
    const list = actions.filter((action) => PANEL_WIDE_ACTIONS.has(action.key));
    expect(list).toHaveLength(PANEL_WIDE_ACTIONS.size);
    for (const role of ["admin", "socio", "tecnico", "gestor", "funcionario"] as const) expect((await deniedFor(role, list)).length, role).toBe(list.length);
    for (const role of ["freelancer", "cliente"] as const) expect(await deniedFor(role, list), role).toEqual([]);
  });

  it("GESTOR: nada de financeiro, site, configurações, usuários nem demonstração do kit", async () => {
    const forbidden = actions.filter((action) => /^(financeiro|site|config|kit)\//.test(action.file));
    expect(forbidden.length).toBeGreaterThan(30);
    expect(await deniedFor("gestor", forbidden)).toEqual([]);
  });

  it("GESTOR: as ações da operação passam do guarda (param na validação do formulário vazio, não no acesso)", async () => {
    browser.token = accounts.gestor.token;
    const operation = actions.filter((action) => /^(leads|clientes|orcamentos|contratos|projetos|tarefas|agenda|conteudo|marca)\//.test(action.file));
    const blocked: string[] = [];
    for (const action of operation) {
      // excluir cliente, contrato e projeto não é do gestor (ver a matriz)
      const cannotDelete = /^(clientes|contratos|projetos)\//.test(action.file) && /^delete/.test(action.name);
      const result = await call(action).catch(() => "erro-depois-do-guarda");
      if ((result === NO_ACCESS) !== cannotDelete) blocked.push(`${action.key} → ${String(result === NO_ACCESS ? "barrada" : "passou")}`);
    }
    expect(blocked).toEqual([]);
  });

  it("TÉCNICO: não gerencia usuários nem notificações (volta ao início do painel); o resto da operação passa", async () => {
    browser.token = accounts.tecnico.token;
    for (const action of actions.filter((item) => /^config\/(usuarios|notificacoes)\//.test(item.file))) {
      expect(await call(action), action.key).toBe("REDIRECT:/painel");
    }
    for (const action of actions.filter((item) => /^(financeiro|leads|site\/faq)\//.test(item.file))) {
      const result = await call(action).catch(() => "erro-depois-do-guarda");
      expect(typeof result === "string" ? result : "passou", action.key).not.toMatch(/^REDIRECT:\/(login|painel$)/);
    }
  });
});

describe("as mesmas regras, com dados de verdade", () => {
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };
  const find = (key: string) => {
    const action = actions.find((item) => item.key === key);
    if (!action) throw new Error(`action não encontrada: ${key}`);
    return action;
  };

  it("lançamento financeiro: gestor e freelancer não excluem (o registro continua lá); o técnico exclui", async () => {
    const [entry] = await db
      .insert(financeEntries)
      .values({ type: "despesa", category: "outras_despesas", description: "[Teste] lançamento protegido", amountCents: 1000, dueDate: "2026-12-10" })
      .returning({ id: financeEntries.id });
    const remove = () => outcome(() => find("financeiro/actions.ts#deleteEntryAction").run(initialActionState, form({ id: String(entry.id) })));
    const exists = async () => (await db.select({ id: financeEntries.id }).from(financeEntries).where(eq(financeEntries.id, entry.id))).length === 1;

    for (const role of ["gestor", "funcionario", "freelancer", "cliente"] as const) {
      browser.token = accounts[role].token;
      expect(await remove(), role).toBe(NO_ACCESS);
      expect(await exists(), role).toBe(true);
    }
    browser.token = accounts.tecnico.token;
    await remove();
    expect(await exists()).toBe(false);
  });

  it("cliente (ficha): o gestor não exclui; o sócio exclui", async () => {
    const [client] = await db.insert(clients).values({ name: "[Teste] ficha protegida" }).returning({ id: clients.id });
    const remove = () => outcome(() => find("clientes/actions.ts#deleteClientAction").run(initialActionState, form({ id: String(client.id) })));
    const exists = async () => (await db.select({ id: clients.id }).from(clients).where(eq(clients.id, client.id))).length === 1;
    browser.token = accounts.gestor.token;
    expect(await remove()).toBe(NO_ACCESS);
    expect(await exists()).toBe(true);
    browser.token = accounts.socio.token;
    await remove();
    expect(await exists()).toBe(false);
  });

  it("contas: só admin e sócio criam; técnico e gestor não — e ninguém muda as próprias permissões", async () => {
    const create = (email: string) =>
      outcome(() => find("config/usuarios/actions.ts#createUserAction").run(initialActionState, form({ name: "[Teste] criada pela action", email, role: "admin" })));
    const email = (tag: string) => `teste-action-${tag}-${Date.now()}@nos.test`;
    const count = async (address: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, address))).length;

    const byTecnico = email("tecnico");
    browser.token = accounts.tecnico.token;
    expect(await create(byTecnico)).toBe("REDIRECT:/painel");
    const byGestor = email("gestor");
    browser.token = accounts.gestor.token;
    expect(await create(byGestor)).toBe(NO_ACCESS);
    expect((await count(byTecnico)) + (await count(byGestor))).toBe(0);

    const bySocio = email("socio");
    browser.token = accounts.socio.token;
    expect(await create(bySocio)).toMatchObject({ ok: true });
    expect(await count(bySocio)).toBe(1);
    await db.delete(users).where(eq(users.email, bySocio));

    const setPermissions = (id: number, grant: string[]) =>
      outcome(() => find("config/usuarios/actions.ts#setUserPermissionsAction").run(initialActionState, form({ id: String(id), grant: JSON.stringify(grant), deny: "[]" })));
    expect(await setPermissions(accounts.gestor.id, ["financeiro:ver"])).toMatchObject({ ok: true });
    expect(await setPermissions(accounts.gestor.id, ["usuarios:editar"])).toMatchObject({ ok: false }); // módulo reservado
    expect(await setPermissions(accounts.socio.id, [])).toMatchObject({ ok: false }); // as próprias
    expect(await setPermissions(accounts.admin.id, [])).toMatchObject({ ok: true }); // limpar é permitido
    browser.token = accounts.gestor.token;
    expect(await setPermissions(accounts.gestor.id, ["dados:baixar"])).toBe(NO_ACCESS);
    const [gestor] = await db.select({ permissions: users.permissions }).from(users).where(eq(users.id, accounts.gestor.id));
    expect(gestor.permissions).toEqual({ grant: ["financeiro:ver"], deny: [] });
  });
});
