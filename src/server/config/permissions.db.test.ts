/**
 * Contas × permissões no banco de teste: o sistema nunca fica sem administrador/sócio ativo, e os ajustes
 * individuais só são gravados para quem pode recebê-los.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { UserRole } from "@/lib/domain";
import { can, parseOverrides } from "@/lib/permissions";
import { countOtherActiveAdmins, createUser, getUser, listUsers, setUserActive, setUserPermissions, updateUser } from "./users";

const created: number[] = [];
let run = 0;
afterAll(async () => {
  if (created.length) await db.delete(users).where(inArray(users.id, created));
});

async function makeUser(role: UserRole) {
  const result = await createUser({ name: `[Teste] ${role}`, email: `teste-perm-${role}-${Date.now()}-${run++}@nos.test`, role });
  if (!result.ok) throw new Error("falhou");
  created.push(result.user.id);
  return result.user;
}

/** Roda `fn` com as demais contas de administrador/sócio temporariamente desativadas (banco de testes isolado). */
async function alone<T>(keepIds: number[], fn: () => Promise<T>): Promise<T> {
  const all = await db.select({ id: users.id, role: users.role, active: users.active }).from(users);
  const others = all.filter((user) => (user.role === "admin" || user.role === "socio") && user.active && !keepIds.includes(user.id));
  for (const other of others) await db.update(users).set({ active: false }).where(eq(users.id, other.id));
  try {
    return await fn();
  } finally {
    for (const other of others) await db.update(users).set({ active: true }).where(eq(users.id, other.id));
  }
}

describe("sempre existe ao menos um administrador ou sócio ativo", () => {
  it("o último SÓCIO ativo não pode ser desativado nem rebaixado (sócio conta como administrador)", async () => {
    const socio = await makeUser("socio");
    await alone([socio.id], async () => {
      expect(await countOtherActiveAdmins(socio.id)).toBe(0);
      expect(await setUserActive(socio.id, false)).toEqual({ ok: false, error: "last_admin" });
      for (const role of ["gestor", "tecnico", "funcionario", "freelancer", "cliente"] as const) {
        expect(await updateUser(socio.id, { name: socio.name, email: socio.email, role }), role).toEqual({ ok: false, error: "last_admin" });
      }
      // trocar entre sócio e admin não tranca nada: continua havendo quem administre
      expect((await updateUser(socio.id, { name: socio.name, email: socio.email, role: "admin" })).ok).toBe(true);
      expect((await updateUser(socio.id, { name: socio.name, email: socio.email, role: "socio" })).ok).toBe(true);
    });
  });

  it("com um admin ativo, o sócio pode ser rebaixado; e com um sócio ativo, o admin pode ser desativado", async () => {
    const socio = await makeUser("socio");
    const admin = await makeUser("admin");
    await alone([socio.id, admin.id], async () => {
      expect((await setUserActive(admin.id, false)).ok).toBe(true); // sobra o sócio
      expect(await setUserActive(socio.id, false)).toEqual({ ok: false, error: "last_admin" });
      expect((await setUserActive(admin.id, true)).ok).toBe(true);
      expect((await updateUser(socio.id, { name: socio.name, email: socio.email, role: "gestor" })).ok).toBe(true); // sobra o admin
      expect(await setUserActive(admin.id, false)).toEqual({ ok: false, error: "last_admin" });
    });
  });

  it("contas de outros perfis não contam como administrador e podem ser desativadas à vontade", async () => {
    const admin = await makeUser("admin");
    const others = await Promise.all((["gestor", "tecnico", "funcionario", "freelancer", "cliente"] as const).map(makeUser));
    await alone([admin.id], async () => {
      expect(await countOtherActiveAdmins(admin.id)).toBe(0);
      expect(await setUserActive(admin.id, false)).toEqual({ ok: false, error: "last_admin" });
      for (const other of others) expect((await setUserActive(other.id, false)).ok, other.role).toBe(true);
    });
  });

  it("cria conta em qualquer perfil, sem ajustes individuais", async () => {
    for (const role of ["socio", "gestor", "funcionario", "freelancer", "cliente"] as const) {
      const user = await makeUser(role);
      expect(user.role).toBe(role);
      expect(user.permissions).toEqual({ grant: [], deny: [] });
      expect(user.mustChangePassword).toBe(true);
    }
    expect((await listUsers()).every((user) => !("passwordHash" in user))).toBe(true);
  });
});

describe("ajustes individuais de permissão (setUserPermissions)", () => {
  it("grava concessões e negações validadas; valem para can() na leitura seguinte", async () => {
    const gestor = await makeUser("gestor");
    const result = await setUserPermissions(gestor.id, { grant: ["financeiro:ver", "financeiro:ver"], deny: ["leads:excluir"] });
    if (!result.ok) throw new Error(result.message);
    expect(result.user.permissions).toEqual({ grant: ["financeiro:ver"], deny: ["leads:excluir"] });
    const stored = await getUser(gestor.id);
    const subject = { role: stored!.role, permissions: parseOverrides(stored!.permissions) };
    expect(can(subject, "financeiro", "ver")).toBe(true);
    expect(can(subject, "financeiro", "editar")).toBe(false);
    expect(can(subject, "leads", "excluir")).toBe(false);
    // limpar volta ao padrão do perfil
    expect((await setUserPermissions(gestor.id, { grant: [], deny: [] })).ok).toBe(true);
    expect((await getUser(gestor.id))!.permissions).toEqual({ grant: [], deny: [] });
  });

  it("recusa lista inválida (chave desconhecida, formato errado, campo a mais) sem gravar nada", async () => {
    const gestor = await makeUser("gestor");
    for (const bad of [{ grant: ["financeiro:tudo"], deny: [] }, { grant: "financeiro:ver", deny: [] }, { grant: [] }, null, "x", { grant: [], deny: [], role: "admin" }, { grant: [["financeiro:ver"]], deny: [] }]) {
      const result = await setUserPermissions(gestor.id, bad);
      expect(result.ok, JSON.stringify(bad)).toBe(false);
      if (!result.ok) expect(result.error).toBe("invalid");
    }
    expect((await getUser(gestor.id))!.permissions).toEqual({ grant: [], deny: [] });
  });

  it("admin e sócio não são rebaixados por ajuste; externos não recebem concessões; módulos reservados não são concedidos", async () => {
    const cases: [UserRole, unknown][] = [
      ["admin", { grant: [], deny: ["usuarios:editar"] }],
      ["socio", { grant: [], deny: ["financeiro:ver"] }],
      ["freelancer", { grant: ["projetos:ver"], deny: [] }],
      ["cliente", { grant: ["clientes:ver"], deny: [] }],
      ["gestor", { grant: ["usuarios:editar"], deny: [] }],
      ["tecnico", { grant: ["societario:ver"], deny: [] }],
    ];
    for (const [role, input] of cases) {
      const user = await makeUser(role);
      const result = await setUserPermissions(user.id, input);
      expect(result.ok, role).toBe(false);
      if (!result.ok) expect(result.error).toBe("not_adjustable");
      expect((await getUser(user.id))!.permissions).toEqual({ grant: [], deny: [] });
    }
    expect(await setUserPermissions(99_999_999, { grant: [], deny: [] })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("mudar o perfil zera os ajustes (são relativos ao perfil) e encerra as sessões", async () => {
    const user = await makeUser("gestor");
    await setUserPermissions(user.id, { grant: ["financeiro:ver", "dados:baixar"], deny: [] });
    await db.insert(sessions).values({ id: `teste-perm-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 1e6), lastSeenAt: new Date() });
    // editar só o nome mantém os ajustes
    await updateUser(user.id, { name: "[Teste] outro nome", email: user.email, role: "gestor" });
    expect((await getUser(user.id))!.permissions.grant).toEqual(["dados:baixar", "financeiro:ver"]);
    const updated = await updateUser(user.id, { name: "[Teste] outro nome", email: user.email, role: "funcionario" });
    expect(updated.ok && updated.user.permissions).toEqual({ grant: [], deny: [] });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });
});
