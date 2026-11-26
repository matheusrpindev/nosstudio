/**
 * Os guardas de `@/lib/auth` com sessões DE VERDADE no banco de teste (só o cookie e a navegação são simulados):
 * quem passa em cada um, por perfil; conta desativada; sessão vencida; troca de senha obrigatória; ajustes
 * individuais. É a prova de que freelancer e cliente não atravessam `requireUser()` — o guarda que todas as
 * páginas, ações e rotas atuais do painel chamam.
 */
import { eq } from "drizzle-orm";
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
import { users } from "@/db/schema";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { makeAccount, outcome, removeAccounts, type TestAccount } from "@/test/accounts";
import {
  authorizePermission,
  getCurrentUser,
  getPanelUser,
  getSessionUser,
  requireAdmin,
  requireClientUser,
  requireEnvironment,
  requirePanelUser,
  requirePermission,
  requireSessionUser,
  requireTeamUser,
  requireUser,
} from "./index";

const LOGIN = "REDIRECT:/login";
const NO_ACCESS = "REDIRECT:/login?aviso=sem-acesso";
const PANEL = "REDIRECT:/painel";
const FORCE = "REDIRECT:/painel/conta/senha?obrigatoria=1";

const accounts = {} as Record<UserRole, TestAccount>;
beforeAll(async () => {
  for (const role of USER_ROLES) accounts[role] = await makeAccount(role);
});
afterAll(removeAccounts);

/** Roda `run` logado como cada perfil e resume: "ok" quando o guarda devolveu aquela conta, senão o redirecionamento. */
async function byRole(run: () => Promise<{ id: number } | null>): Promise<Record<UserRole, string>> {
  const result = {} as Record<UserRole, string>;
  for (const role of USER_ROLES) {
    browser.token = accounts[role].token;
    const value = await outcome(run);
    result[role] = typeof value === "string" ? value : value?.id === accounts[role].id ? "ok" : "null";
  }
  browser.token = null;
  return result;
}

describe("guardas do painel, por perfil", () => {
  it("requireUser (todas as páginas e ações atuais): só quem tem acesso integral — freelancer e cliente BARRADOS", async () => {
    expect(await byRole(() => requireUser())).toEqual({
      admin: "ok",
      socio: "ok",
      tecnico: "ok",
      gestor: NO_ACCESS,
      funcionario: NO_ACCESS,
      freelancer: NO_ACCESS,
      cliente: NO_ACCESS,
    });
  });

  it("getCurrentUser (rotas e telas atuais): os mesmos; para os demais é como não estar logado", async () => {
    expect(await byRole(() => getCurrentUser())).toEqual({
      admin: "ok",
      socio: "ok",
      tecnico: "ok",
      gestor: "null",
      funcionario: "null",
      freelancer: "null",
      cliente: "null",
    });
  });

  it("requireAdmin: admin e sócio; o técnico volta ao início do painel", async () => {
    expect(await byRole(() => requireAdmin())).toEqual({
      admin: "ok",
      socio: "ok",
      tecnico: PANEL,
      gestor: NO_ACCESS,
      funcionario: NO_ACCESS,
      freelancer: NO_ACCESS,
      cliente: NO_ACCESS,
    });
  });

  it("requirePanelUser / getPanelUser: qualquer perfil do painel; freelancer e cliente nunca", async () => {
    const expected = { admin: "ok", socio: "ok", tecnico: "ok", gestor: "ok", funcionario: "ok" };
    expect(await byRole(() => requirePanelUser())).toEqual({ ...expected, freelancer: NO_ACCESS, cliente: NO_ACCESS });
    expect(await byRole(() => getPanelUser())).toEqual({ ...expected, freelancer: "null", cliente: "null" });
  });

  it("getSessionUser: qualquer conta com sessão (não diz nada sobre o que ela pode ver)", async () => {
    expect(Object.values(await byRole(() => getSessionUser()))).toEqual(USER_ROLES.map(() => "ok"));
  });
});

describe("guardas dos outros ambientes", () => {
  it("requireTeamUser: funcionário e freelancer; quem é do painel volta para o painel; cliente fica de fora", async () => {
    expect(await byRole(() => requireTeamUser())).toEqual({
      funcionario: "ok",
      freelancer: "ok",
      admin: PANEL,
      socio: PANEL,
      tecnico: PANEL,
      gestor: NO_ACCESS, // o painel restrito ainda não abriu: não há para onde mandá-lo
      cliente: NO_ACCESS,
    });
  });

  it("requireClientUser: só o perfil cliente", async () => {
    expect(await byRole(() => requireClientUser())).toEqual({
      cliente: "ok",
      admin: PANEL,
      socio: PANEL,
      tecnico: PANEL,
      gestor: NO_ACCESS,
      funcionario: NO_ACCESS,
      freelancer: NO_ACCESS,
    });
  });

  it("requireEnvironment é o mesmo guarda dos três atalhos", async () => {
    expect(await byRole(() => requireEnvironment("painel"))).toEqual(await byRole(() => requirePanelUser()));
    expect(await byRole(() => requireEnvironment("equipe"))).toEqual(await byRole(() => requireTeamUser()));
    expect(await byRole(() => requireEnvironment("cliente"))).toEqual(await byRole(() => requireClientUser()));
  });
});

describe("requirePermission (módulo × ação, no servidor)", () => {
  it("financeiro:ver — admin, sócio e técnico; gestor e funcionário não; externos nunca", async () => {
    expect(await byRole(() => requirePermission("financeiro", "ver"))).toEqual({
      admin: "ok",
      socio: "ok",
      tecnico: "ok",
      gestor: NO_ACCESS,
      funcionario: NO_ACCESS,
      freelancer: NO_ACCESS,
      cliente: NO_ACCESS,
    });
  });

  it("leads:editar — o gestor passa (é do módulo dele); funcionário, freelancer e cliente não", async () => {
    expect(await byRole(() => requirePermission("leads", "editar"))).toEqual({
      admin: "ok",
      socio: "ok",
      tecnico: "ok",
      gestor: "ok",
      funcionario: NO_ACCESS,
      freelancer: NO_ACCESS,
      cliente: NO_ACCESS,
    });
  });

  it("clientes:excluir — o gestor edita mas não exclui", async () => {
    const result = await byRole(() => requirePermission("clientes", "excluir"));
    expect(result.gestor).toBe(NO_ACCESS);
    expect(result.tecnico).toBe("ok");
  });

  it("tarefas:editar — o funcionário só tem 'nos projetos em que está': NÃO passa no guarda do módulo inteiro", async () => {
    const result = await byRole(() => requirePermission("tarefas", "editar"));
    expect(result.funcionario).toBe(NO_ACCESS);
    expect(result.gestor).toBe("ok");
  });

  it("usuarios:editar e dados:baixar — só admin e sócio; o técnico volta ao início do painel", async () => {
    for (const [mod, action] of [["usuarios", "editar"], ["dados", "baixar"], ["auditoria", "ver"], ["societario", "ver"]] as const) {
      expect(await byRole(() => requirePermission(mod, action)), `${mod}:${action}`).toEqual({
        admin: "ok",
        socio: "ok",
        tecnico: PANEL,
        gestor: NO_ACCESS,
        funcionario: NO_ACCESS,
        freelancer: NO_ACCESS,
        cliente: NO_ACCESS,
      });
    }
  });
});

describe("authorizePermission (Route Handlers: resposta JSON, sem redirecionar)", () => {
  const status = async (run: () => Promise<{ id: number } | Response>) => {
    const value = await run();
    return value instanceof Response ? value.status : 200;
  };

  it("sem sessão: 401", async () => {
    browser.token = null;
    const response = await authorizePermission("financeiro", "baixar");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(401);
    expect((response as Response).headers.get("cache-control")).toBe("no-store");
  });

  it("por perfil: 403 para quem não entra no painel ou não tem a permissão", async () => {
    const results = {} as Record<UserRole, number>;
    for (const role of USER_ROLES) {
      browser.token = accounts[role].token;
      results[role] = await status(() => authorizePermission("financeiro", "baixar"));
    }
    expect(results).toEqual({ admin: 200, socio: 200, tecnico: 200, gestor: 403, funcionario: 403, freelancer: 403, cliente: 403 });
    browser.token = accounts.tecnico.token;
    expect(await status(() => authorizePermission("dados", "baixar"))).toBe(403);
    browser.token = accounts.freelancer.token;
    const denied = (await authorizePermission("leads", "ver")) as Response;
    expect(await denied.json()).toEqual({ error: "Sua conta não tem acesso ao painel." });
  });
});

describe("sessão inválida, conta desativada, troca de senha obrigatória", () => {
  it("sem cookie: todo guarda manda para o login", async () => {
    browser.token = null;
    for (const run of [requireUser, requireAdmin, requirePanelUser, requireTeamUser, requireClientUser, requireSessionUser, () => requirePermission("leads", "ver")]) {
      expect(await outcome(() => run())).toBe(LOGIN);
    }
    expect(await getCurrentUser()).toBeNull();
    expect(await getSessionUser()).toBeNull();
  });

  it("token desconhecido ou sessão vencida: como não estar logado", async () => {
    browser.token = "token-que-nao-existe-no-banco-0123456789";
    expect(await outcome(() => requireUser())).toBe(LOGIN);
    const expired = await makeAccount("admin", { expired: true });
    browser.token = expired.token;
    expect(await outcome(() => requireUser())).toBe(LOGIN);
    expect(await getSessionUser()).toBeNull();
  });

  it("conta DESATIVADA: a sessão deixa de valer na hora, em qualquer guarda e para qualquer perfil", async () => {
    for (const role of ["admin", "gestor", "freelancer", "cliente"] as const) {
      const account = await makeAccount(role);
      browser.token = account.token;
      expect(await getSessionUser(), role).not.toBeNull();
      await db.update(users).set({ active: false }).where(eq(users.id, account.id));
      expect(await getSessionUser(), role).toBeNull();
      expect(await outcome(() => requireUser())).toBe(LOGIN);
      expect(await outcome(() => requireEnvironment(role === "cliente" ? "cliente" : role === "freelancer" ? "equipe" : "painel"))).toBe(LOGIN);
      expect(((await authorizePermission("leads", "ver")) as Response).status).toBe(401);
    }
  });

  it("troca de senha OBRIGATÓRIA: nada do painel abre antes de trocar; só a própria tela de troca", async () => {
    const account = await makeAccount("admin", { mustChangePassword: true });
    browser.token = account.token;
    expect(await outcome(() => requireUser())).toBe(FORCE);
    expect(await outcome(() => requireAdmin())).toBe(FORCE);
    expect(await outcome(() => requirePanelUser())).toBe(FORCE);
    expect(await outcome(() => requirePermission("leads", "ver"))).toBe(FORCE);
    expect(await outcome(() => requireSessionUser())).toBe(FORCE);
    const api = (await authorizePermission("leads", "ver")) as Response;
    expect(api.status).toBe(403);
    // a tela de troca (e a action de troca) passam
    expect(((await requireUser({ allowPasswordChange: true })) as { id: number }).id).toBe(account.id);
    expect(((await requireSessionUser({ allowPasswordChange: true })) as { id: number }).id).toBe(account.id);
  });

  it("troca obrigatória não vira atalho: freelancer com a marca continua fora do painel", async () => {
    const account = await makeAccount("freelancer", { mustChangePassword: true });
    browser.token = account.token;
    expect(await outcome(() => requireUser({ allowPasswordChange: true }))).toBe(NO_ACCESS);
    expect(await outcome(() => requireUser())).toBe(NO_ACCESS);
    expect(await outcome(() => requirePanelUser({ allowPasswordChange: true }))).toBe(NO_ACCESS);
  });
});

describe("ajustes individuais nos guardas", () => {
  it("técnico com um módulo negado: perde as telas atuais (requireUser) e o módulo; o resto segue por permissão", async () => {
    const account = await makeAccount("tecnico", { permissions: { grant: [], deny: ["financeiro:ver"] } });
    browser.token = account.token;
    expect(await outcome(() => requireUser())).toBe(NO_ACCESS);
    expect(await getCurrentUser()).toBeNull();
    expect(await outcome(() => requirePermission("financeiro", "ver"))).toBe(NO_ACCESS);
    expect(await outcome(() => requirePermission("financeiro", "editar"))).toBe(NO_ACCESS);
    expect(((await requirePermission("leads", "editar")) as { id: number }).id).toBe(account.id);
  });

  it("gestor com concessão: passa só no que foi concedido", async () => {
    const account = await makeAccount("gestor", { permissions: { grant: ["financeiro:ver"], deny: [] } });
    browser.token = account.token;
    expect(((await requirePermission("financeiro", "ver")) as { id: number }).id).toBe(account.id);
    expect(await outcome(() => requirePermission("financeiro", "editar"))).toBe(NO_ACCESS);
    expect(await outcome(() => requireUser())).toBe(NO_ACCESS); // continua restrito
  });

  it("vale na requisição seguinte: tirar a permissão no banco barra sem precisar de novo login", async () => {
    const account = await makeAccount("gestor");
    browser.token = account.token;
    expect(((await requirePermission("leads", "editar")) as { id: number }).id).toBe(account.id);
    await db.update(users).set({ permissions: { grant: [], deny: ["leads:editar"] } }).where(eq(users.id, account.id));
    expect(await outcome(() => requirePermission("leads", "editar"))).toBe(NO_ACCESS);
    // …e mudar o perfil também
    await db.update(users).set({ role: "cliente", permissions: { grant: [], deny: [] } }).where(eq(users.id, account.id));
    expect(await outcome(() => requirePermission("leads", "ver"))).toBe(NO_ACCESS);
    expect(await outcome(() => requirePanelUser())).toBe(NO_ACCESS);
  });

  it("JSON de permissões corrompido no banco: vira 'sem ajustes' (nunca erro, nunca permissão a mais)", async () => {
    const account = await makeAccount("gestor");
    await db.update(users).set({ permissions: { grant: ["usuarios:editar", "qualquer:coisa"], deny: "x" } as never }).where(eq(users.id, account.id));
    browser.token = account.token;
    const user = await getSessionUser();
    expect(user?.permissions).toEqual({ grant: ["usuarios:editar"], deny: [] });
    expect(await outcome(() => requirePermission("usuarios", "editar"))).toBe(NO_ACCESS); // módulo reservado
    expect(((await requirePermission("leads", "ver")) as { id: number }).id).toBe(account.id);
  });
});
