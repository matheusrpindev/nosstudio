import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { countRecords, exportAllJson, exportCsv } from "./data";
import { createUser, resetUserPassword, setUserActive, updateUser } from "./users";

const created: number[] = [];
const email = (tag: string) => `[teste]-${tag}-${Date.now()}@nos.test`.replace("[teste]", "teste");

afterAll(async () => {
  if (created.length) await db.delete(users).where(inArray(users.id, created));
});

async function makeUser(tag: string, role: "admin" | "tecnico" = "admin") {
  const result = await createUser({ name: `[Teste] ${tag}`, email: email(tag), role });
  if (!result.ok) throw new Error("falhou");
  created.push(result.user.id);
  return result;
}

describe("contas do painel", () => {
  it("cria com senha temporária (só o hash fica no banco) e exige troca", async () => {
    const { user, password } = await makeUser("criar");
    expect(user.mustChangePassword).toBe(true);
    expect(user.active).toBe(true);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.passwordHash).not.toContain(password);
    expect(await verifyPassword(row.passwordHash, password)).toBe(true);
  });

  it("recusa e-mail repetido", async () => {
    const { user } = await makeUser("dup");
    const again = await createUser({ name: "Outra", email: user.email, role: "tecnico" });
    expect(again).toEqual({ ok: false, error: "email_taken" });
  });

  it("redefinir senha troca o hash, exige troca e encerra as sessões", async () => {
    const { user, password } = await makeUser("reset");
    await db.insert(sessions).values({ id: `teste-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 1e6), lastSeenAt: new Date() });
    const reset = await resetUserPassword(user.id);
    if (!reset.ok) throw new Error("falhou");
    expect(reset.password).not.toBe(password);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(row.passwordHash, reset.password)).toBe(true);
    expect(await verifyPassword(row.passwordHash, password)).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });

  it("desativar encerra as sessões e reativar volta a permitir", async () => {
    const { user } = await makeUser("ativo");
    await db.insert(sessions).values({ id: `teste-b-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 1e6), lastSeenAt: new Date() });
    const off = await setUserActive(user.id, false);
    expect(off.ok && off.user.active).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    const on = await setUserActive(user.id, true);
    expect(on.ok && on.user.active).toBe(true);
  });

  it("não deixa desativar nem rebaixar o último administrador ativo", async () => {
    // deixa só uma conta administradora ativa: desativa as demais temporariamente (banco de testes isolado)
    const all = await db.select({ id: users.id, role: users.role, active: users.active }).from(users);
    const others = all.filter((u) => (u.role === "admin" || u.role === "socio") && u.active);
    const { user } = await makeUser("ultimo");
    for (const other of others) await db.update(users).set({ active: false }).where(eq(users.id, other.id));
    try {
      expect(await setUserActive(user.id, false)).toEqual({ ok: false, error: "last_admin" });
      expect(await updateUser(user.id, { name: user.name, email: user.email, role: "tecnico" })).toEqual({ ok: false, error: "last_admin" });
      // com outro administrador ativo, passa
      const second = await makeUser("segundo");
      expect((await setUserActive(user.id, false)).ok).toBe(true);
      expect(second.user.active).toBe(true);
    } finally {
      for (const other of others) await db.update(users).set({ active: true }).where(eq(users.id, other.id));
    }
  });

  it("mudar perfil ou e-mail encerra as sessões; editar só o nome não", async () => {
    const { user } = await makeUser("edit", "tecnico");
    await db.insert(sessions).values({ id: `teste-c-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 1e6), lastSeenAt: new Date() });
    await updateUser(user.id, { name: "[Teste] novo nome", email: user.email, role: "tecnico" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(1);
    await updateUser(user.id, { name: "[Teste] novo nome", email: user.email, role: "admin" });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
  });
});

describe("exportação", () => {
  it("o JSON nunca contém hash de senha, sessões, tokens nem rate limits", async () => {
    await makeUser("export");
    const { user: exporter } = await makeUser("exportador");
    const { json, counts } = await exportAllJson(new Date("2026-11-18T12:00:00Z"), exporter);
    const payload = JSON.parse(json);
    expect(Object.keys(payload.tabelas)).toContain("users");
    expect(Object.keys(payload.tabelas)).toContain("clients");
    for (const forbidden of ["sessions", "password_reset_tokens", "rate_limits"]) expect(payload.tabelas[forbidden]).toBeUndefined();
    expect(json).not.toMatch(/password_?hash/i);
    expect(json).not.toContain("$argon2");
    expect(counts.users).toBeGreaterThan(0);
  });

  it("a contagem não inclui as tabelas proibidas e bate com o JSON", async () => {
    const { user: exporter } = await makeUser("exportador-contagem");
    const counts = await countRecords();
    expect(counts.map((c) => c.name)).not.toContain("sessions");
    const { counts: exported } = await exportAllJson(new Date(), exporter);
    for (const row of counts) expect(exported[row.name]).toBe(row.total);
  });

  it("CSVs saem com BOM e separador ponto e vírgula", async () => {
    for (const kind of ["clientes", "leads", "financeiro"] as const) {
      const { csv } = await exportCsv(kind);
      expect(csv.startsWith("﻿ID;")).toBe(true);
    }
  });
});
