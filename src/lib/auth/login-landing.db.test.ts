/**
 * A action de login de ponta a ponta no banco de teste (cookies e navegação simulados): cada perfil é mandado
 * ao ambiente dele; perfil cujo ambiente ainda não tem telas recebe uma resposta clara e NENHUMA sessão — nunca
 * cai no painel.
 */
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (cookie: string | { name: string }) => void jar.delete(typeof cookie === "string" ? cookie : cookie.name),
  }),
  headers: async () => new Headers({ "user-agent": "vitest" }),
}));
vi.mock("next/server", () => ({ connection: async () => {}, after: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { db } from "@/db";
import { auditLog, rateLimits, sessions, users } from "@/db/schema";
import { initialActionState } from "@/lib/action-state";
import { USER_ROLES, type UserRole } from "@/lib/domain";
import { loginAction } from "./actions";
import { hashPassword } from "./password";
import { SESSION_COOKIE } from "./session";

const PASSWORD = "senha-de-teste-2026";
const ids = {} as Record<UserRole, number>;
const emails = {} as Record<UserRole, string>;
const extra: number[] = [];
let passwordHash = "";

async function addUser(role: UserRole, over: Partial<typeof users.$inferInsert> = {}) {
  const [row] = await db
    .insert(users)
    .values({ name: `[Teste] login ${role}`, email: `teste-login-${role}-${Date.now()}-${extra.length}@nos.test`, passwordHash, role, ...over })
    .returning();
  extra.push(row.id);
  return row;
}

async function login(email: string, password = PASSWORD, next = "") {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("next", next);
  try {
    const state = await loginAction(initialActionState, form);
    return { redirect: null as string | null, message: state.message ?? "" };
  } catch (error) {
    const message = (error as Error).message;
    if (!message.startsWith("REDIRECT:")) throw error;
    return { redirect: message.slice("REDIRECT:".length), message: "" };
  }
}
const sessionsOf = (userId: number) => db.select().from(sessions).where(eq(sessions.userId, userId));

beforeAll(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, "login:%"));
  passwordHash = await hashPassword(PASSWORD);
  for (const role of USER_ROLES) {
    const row = await addUser(role);
    ids[role] = row.id;
    emails[role] = row.email;
  }
});
beforeEach(() => jar.clear());
afterAll(async () => {
  await db.delete(users).where(inArray(users.id, extra));
  await db.delete(rateLimits).where(like(rateLimits.key, "login:%"));
});

describe("login: destino por perfil", () => {
  it("admin, sócio e técnico entram e vão para o painel", async () => {
    for (const role of ["admin", "socio", "tecnico"] as const) {
      jar.clear();
      expect(await login(emails[role]), role).toEqual({ redirect: "/painel", message: "" });
      expect(await sessionsOf(ids[role])).toHaveLength(1);
      expect(jar.has(SESSION_COOKIE)).toBe(true);
    }
  });

  it("gestor, funcionário, freelancer e cliente: senha certa, resposta clara, NENHUMA sessão — e nada de painel", async () => {
    for (const role of ["gestor", "funcionario", "freelancer", "cliente"] as const) {
      jar.clear();
      const result = await login(emails[role], PASSWORD, "/painel/financeiro");
      expect(result.redirect, role).toBeNull();
      expect(result.message).toMatch(/está ativa, mas o acesso a .+ ainda não foi liberado/);
      expect(await sessionsOf(ids[role]), role).toHaveLength(0);
      expect(jar.has(SESSION_COOKIE)).toBe(false);
      const audit = await db.select().from(auditLog).where(and(eq(auditLog.action, "login_sem_ambiente"), eq(auditLog.entityId, String(ids[role]))));
      expect(audit).toHaveLength(1);
    }
    expect((await login(emails.freelancer)).message).toContain("Área da Equipe");
    expect((await login(emails.cliente)).message).toContain("Área do Cliente");
  });

  it("a mensagem do ambiente só aparece com a senha CERTA (não revela quais e-mails são de clientes)", async () => {
    for (const role of ["freelancer", "cliente", "admin"] as const) {
      expect(await login(emails[role], "senha-errada-123")).toEqual({ redirect: null, message: "E-mail ou senha incorretos." });
    }
    expect(await login("ninguem@nos.test")).toEqual({ redirect: null, message: "E-mail ou senha incorretos." });
    const off = await addUser("cliente", { active: false });
    expect(await login(off.email)).toEqual({ redirect: null, message: "E-mail ou senha incorretos." });
  });

  it("técnico com um módulo negado fica restrito: também não entra enquanto o painel restrito não abrir", async () => {
    const limited = await addUser("tecnico", { permissions: { grant: [], deny: ["financeiro:ver"] } });
    const result = await login(limited.email);
    expect(result.redirect).toBeNull();
    expect(result.message).toContain("Painel Administrativo");
    expect(await sessionsOf(limited.id)).toHaveLength(0);
  });

  it("`next` só vale dentro do painel; troca de senha obrigatória vem antes", async () => {
    expect((await login(emails.admin, PASSWORD, "/painel/clientes?status=ativo")).redirect).toBe("/painel/clientes?status=ativo");
    for (const next of ["/cliente", "/equipe/projetos/3", "https://malicioso.example", "//malicioso.example"]) {
      jar.clear();
      expect((await login(emails.admin, PASSWORD, next)).redirect, next).toBe("/painel");
    }
    const pending = await addUser("admin", { mustChangePassword: true });
    jar.clear();
    expect((await login(pending.email, PASSWORD, "/painel/clientes")).redirect).toBe("/painel/conta/senha?obrigatoria=1");
  });
});
