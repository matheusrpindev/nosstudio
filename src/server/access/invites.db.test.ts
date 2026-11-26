/**
 * Convites no banco de teste: sem convite válido não nasce conta. Cobre expirado, revogado, reutilizado, e-mail
 * divergente, política de senha, limite de tentativas e os vínculos criados no aceite.
 * Nenhum e-mail é enviado: `createInvite` não envia (quem envia é a action) e o `sendMail` está simulado.
 */
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ sendMail: vi.fn(async (_input: { to: string; subject: string; text: string }) => ({ delivered: true })) }));
vi.mock("@/lib/mail", () => ({ sendMail: mail.sendMail }));

import { db } from "@/db";
import { auditLog, clients, clientUsers, projectMembers, projects, rateLimits, sessions, userInvites, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { exportAllJson } from "@/server/config/data";
import { makeAccount, removeAccounts, type TestAccount } from "@/test/accounts";
import { acceptInvite, createInvite, getPendingInvite, INVITE_INVALID_MESSAGE, INVITE_LIFETIME_MS, inviteLink, inviteStatus, listInvites, revokeInvite, sendInviteEmail, type InviteInput } from "./invites";
import { canAccessProject, projectScope } from "./scope";

const PASSWORD = "senha-boa-2026";
const DAY = 24 * 60 * 60 * 1000;
let admin: TestAccount;
let socio: TestAccount;
let gestor: TestAccount;
let tecnico: TestAccount;
let clientId = 0;
let otherClientId = 0;
let projectId = 0;
let run = 0;
const createdUserIds: number[] = [];

const email = (tag: string) => `teste-convite-${tag}-${Date.now()}-${run++}@nos.test`;
const ip = () => ({ ipBucket: `203.0.113.${run++ % 250}` });

async function invite(input: Partial<InviteInput> & { role: InviteInput["role"] }, now = new Date()) {
  const result = await createInvite({ email: email(input.role), ...input }, admin, now);
  if (!result.ok) throw new Error(`convite recusado: ${result.error}`);
  return result;
}
async function accept(token: string, to: string, over: Partial<{ name: string; password: string }> = {}, now = new Date()) {
  const result = await acceptInvite({ token, email: to, name: over.name ?? "[Teste] Convidada", password: over.password ?? PASSWORD }, ip(), now);
  if (result.ok) createdUserIds.push(result.user.id);
  return result;
}

beforeAll(async () => {
  admin = await makeAccount("admin");
  socio = await makeAccount("socio");
  gestor = await makeAccount("gestor");
  tecnico = await makeAccount("tecnico");
  const inserted = await db.insert(clients).values([{ name: "[Teste] Cliente do convite" }, { name: "[Teste] Outro cliente" }]).returning({ id: clients.id });
  [clientId, otherClientId] = inserted.map((row) => row.id);
  const [project] = await db.insert(projects).values({ title: "[Teste] Projeto do convite", clientId }).returning({ id: projects.id });
  projectId = project.id;
});
beforeEach(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, "convite%"));
  mail.sendMail.mockClear();
});
afterAll(async () => {
  await db.delete(userInvites).where(like(userInvites.email, "teste-convite-%"));
  if (createdUserIds.length) await db.delete(users).where(inArray(users.id, createdUserIds));
  await db.delete(projects).where(eq(projects.id, projectId));
  await db.delete(clients).where(inArray(clients.id, [clientId, otherClientId]));
  await db.delete(rateLimits).where(like(rateLimits.key, "convite%"));
  await removeAccounts();
});

describe("criar convite", () => {
  it("guarda só o hash do token; o token aparece uma vez e não vai para a auditoria", async () => {
    const { invite: row, token } = await invite({ role: "gestor", name: "Gabi" });
    expect(token.length).toBeGreaterThan(30);
    const [stored] = await db.select().from(userInvites).where(eq(userInvites.id, row.id));
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(row).not.toHaveProperty("tokenHash");
    expect(row.status).toBe("pendente");
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeGreaterThan(INVITE_LIFETIME_MS - 60_000);
    expect(stored.invitedBy).toBe(admin.id);
    const audit = await db.select().from(auditLog).where(eq(auditLog.entityId, String(row.id)));
    const mine = audit.filter((entry) => entry.entity === "user_invite");
    expect(mine.map((entry) => entry.action)).toEqual(["convite_criado"]);
    expect(JSON.stringify(mine)).not.toContain(token);
    expect(JSON.stringify(mine)).not.toContain(row.email); // sem dado pessoal do convidado na auditoria
    expect((await listInvites()).every((item) => !("tokenHash" in item))).toBe(true);
  });

  it("só quem gerencia usuários convida: admin e sócio sim; gestor, técnico e externos não", async () => {
    expect((await createInvite({ email: email("socio"), role: "freelancer" }, socio)).ok).toBe(true);
    for (const actor of [gestor, tecnico, await makeAccount("funcionario"), await makeAccount("freelancer"), await makeAccount("cliente")]) {
      const result = await createInvite({ email: email("negado"), role: "freelancer" }, actor);
      expect(result.ok, actor.role).toBe(false);
      if (!result.ok) expect(result.error).toBe("forbidden");
    }
    // nem com concessão individual: o módulo de usuários é reservado
    const result = await createInvite({ email: email("negado"), role: "admin" }, { ...gestor, permissions: { grant: ["usuarios:editar"], deny: [] } });
    expect(result.ok).toBe(false);
  });

  it("valida perfil, e-mail e as combinações cliente ↔ ficha, projeto ↔ equipe", async () => {
    const error = async (input: InviteInput) => {
      const result = await createInvite(input, admin);
      return result.ok ? "ok" : `${result.error}:${Object.keys(result.fieldErrors ?? {}).join(",")}`;
    };
    expect(await error({ email: "sem-arroba", role: "gestor" })).toBe("invalid:email");
    expect(await error({ email: email("x"), role: "dono" as never })).toBe("invalid:role");
    expect(await error({ email: email("x"), role: "cliente" })).toBe("invalid:clientId"); // cliente precisa da ficha
    expect(await error({ email: email("x"), role: "freelancer", clientId })).toBe("invalid:clientId"); // ficha só para cliente
    expect(await error({ email: email("x"), role: "gestor", projectId })).toBe("invalid:projectId"); // projeto só para equipe
    expect(await error({ email: email("x"), role: "cliente", clientId, projectId })).toBe("invalid:projectId");
    expect(await error({ email: email("x"), role: "cliente", clientId: 99_999_999 })).toBe("client_not_found:clientId");
    expect(await error({ email: email("x"), role: "freelancer", projectId: 99_999_999 })).toBe("project_not_found:projectId");
    expect(await error({ email: admin.email, role: "gestor" })).toBe("email_taken:email"); // já tem conta
    expect(await error({ email: `  ${email("OK").toUpperCase()} `, role: "funcionario", projectId, projectRole: "Editor" })).toBe("ok");
  });

  it("um convite pendente por e-mail: criar outro revoga o anterior", async () => {
    const to = email("duplo");
    const first = await createInvite({ email: to, role: "freelancer" }, admin);
    const second = await createInvite({ email: to, role: "freelancer" }, admin);
    if (!first.ok || !second.ok) throw new Error("falhou");
    expect(await getPendingInvite(first.token)).toBeNull();
    expect((await getPendingInvite(second.token))?.email).toBe(to);
    expect((await accept(first.token, to)).ok).toBe(false);
    expect((await accept(second.token, to)).ok).toBe(true);
  });

  it("limite de convites por pessoa (30 por hora)", async () => {
    const actor = await makeAccount("admin");
    for (let i = 0; i < 30; i++) expect((await createInvite({ email: email("lote"), role: "freelancer" }, actor)).ok).toBe(true);
    const blocked = await createInvite({ email: email("lote"), role: "freelancer" }, actor);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toBe("rate_limited");
  });

  it("o e-mail do convite leva o link com o token — e só é enviado quando a action manda", async () => {
    const { invite: row, token } = await invite({ role: "freelancer", name: "Fred Silva" });
    expect(mail.sendMail).not.toHaveBeenCalled(); // criar não envia nada
    await sendInviteEmail(row, token);
    expect(mail.sendMail).toHaveBeenCalledTimes(1);
    const sent = mail.sendMail.mock.calls[0][0];
    expect(sent.to).toBe(row.email);
    expect(sent.text).toContain(inviteLink(token));
    expect(sent.text).toContain("Olá, Fred!");
    expect(sent.text).toContain("Área da Equipe");
  });
});

describe("aceitar convite", () => {
  it("cria a conta com a senha escolhida, sem troca obrigatória e SEM abrir sessão; o convite fica aceito", async () => {
    const { invite: row, token } = await invite({ role: "gestor" });
    const result = await accept(token, row.email, { name: "  Gabi Gestora  " });
    if (!result.ok) throw new Error(result.error);
    expect(result.user).toMatchObject({ name: "Gabi Gestora", email: row.email, role: "gestor" });
    const [user] = await db.select().from(users).where(eq(users.id, result.user.id));
    expect(user.active).toBe(true);
    expect(user.mustChangePassword).toBe(false);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(user.passwordHash, PASSWORD)).toBe(true);
    expect(user.permissions).toEqual({ grant: [], deny: [] });
    expect(await db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(0);
    const [stored] = await db.select().from(userInvites).where(eq(userInvites.id, row.id));
    expect(stored.acceptedUserId).toBe(user.id);
    expect(inviteStatus(stored)).toBe("aceito");
    const audit = await db.select().from(auditLog).where(eq(auditLog.entityId, String(row.id)));
    expect(audit.filter((entry) => entry.entity === "user_invite").map((entry) => entry.action)).toEqual(["convite_criado", "convite_aceito"]);
  });

  it("o perfil vem do CONVITE, nunca do formulário", async () => {
    const { invite: row, token } = await invite({ role: "freelancer" });
    const result = await acceptInvite({ token, email: row.email, name: "[Teste] Esperta", password: PASSWORD, role: "admin" } as never, ip());
    if (!result.ok) throw new Error(result.error);
    createdUserIds.push(result.user.id);
    expect(result.user.role).toBe("freelancer");
  });

  it("convite de cliente vincula a conta à ficha: ela vê os projetos daquele cliente e só deles", async () => {
    const { invite: row, token } = await invite({ role: "cliente", clientId });
    const result = await accept(token, row.email);
    if (!result.ok) throw new Error(result.error);
    expect(await db.select().from(clientUsers).where(eq(clientUsers.userId, result.user.id))).toMatchObject([{ clientId }]);
    expect(await projectScope(result.user)).toEqual([projectId]);
    const [other] = await db.insert(projects).values({ title: "[Teste] de outro cliente", clientId: otherClientId }).returning({ id: projects.id });
    expect(await canAccessProject(result.user, other.id, "ver")).toBe(false);
    await db.delete(projects).where(eq(projects.id, other.id));
  });

  it("convite de freelancer com projeto: entra como membro só com 'ver'", async () => {
    const { invite: row, token } = await invite({ role: "freelancer", projectId, projectRole: "Drone" });
    const result = await accept(token, row.email);
    if (!result.ok) throw new Error(result.error);
    expect(await db.select().from(projectMembers).where(eq(projectMembers.userId, result.user.id))).toMatchObject([
      { projectId, role: "Drone", canView: true, canEdit: false, canDownload: false, canUpload: false },
    ]);
    expect(await canAccessProject(result.user, projectId, "ver")).toBe(true);
    expect(await canAccessProject(result.user, projectId, "editar")).toBe(false);
    expect(await db.select().from(clientUsers).where(eq(clientUsers.userId, result.user.id))).toHaveLength(0);
  });

  it("SEM CONVITE NÃO HÁ CONTA: token inexistente, vazio ou malformado", async () => {
    const before = (await db.select({ id: users.id }).from(users)).length;
    for (const token of ["", "abc", "x".repeat(43), "x".repeat(500), null, undefined, 42, {}]) {
      const result = await acceptInvite({ token: token as never, email: email("ninguem"), name: "[Teste] Ninguém", password: PASSWORD }, ip());
      expect(result).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
      expect(await getPendingInvite(token)).toBeNull();
    }
    expect((await db.select({ id: users.id }).from(users)).length).toBe(before);
  });

  it("EXPIRADO: recusa depois da validade (e aceita um instante antes)", async () => {
    const now = new Date();
    const late = await invite({ role: "freelancer" }, now);
    const after = new Date(now.getTime() + INVITE_LIFETIME_MS + 1000);
    expect(await getPendingInvite(late.token, after)).toBeNull();
    expect(await accept(late.token, late.invite.email, {}, after)).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
    expect(await db.select().from(users).where(eq(users.email, late.invite.email))).toHaveLength(0);
    expect(inviteStatus({ acceptedAt: null, revokedAt: null, expiresAt: late.invite.expiresAt }, after)).toBe("expirado");

    const inTime = await invite({ role: "freelancer" }, now);
    expect((await accept(inTime.token, inTime.invite.email, {}, new Date(now.getTime() + INVITE_LIFETIME_MS - 1000))).ok).toBe(true);
    // convite criado há 8 dias, visto agora
    const old = await invite({ role: "freelancer" }, new Date(Date.now() - 8 * DAY));
    expect((await accept(old.token, old.invite.email)).ok).toBe(false);
  });

  it("REVOGADO: o link deixa de funcionar; revogar de novo não é erro; convite aceito não é revogável", async () => {
    const { invite: row, token } = await invite({ role: "freelancer" });
    expect((await revokeInvite(row.id, gestor)).ok).toBe(false); // gestor não revoga
    expect((await getPendingInvite(token))?.email).toBe(row.email);
    const revoked = await revokeInvite(row.id, admin);
    expect(revoked.ok && revoked.invite.status).toBe("revogado");
    expect((await revokeInvite(row.id, admin)).ok).toBe(true);
    expect(await getPendingInvite(token)).toBeNull();
    expect(await accept(token, row.email)).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
    expect(await db.select().from(users).where(eq(users.email, row.email))).toHaveLength(0);
    expect(await revokeInvite(99_999_999, admin)).toEqual({ ok: false, error: "not_found" });

    const used = await invite({ role: "freelancer" });
    expect((await accept(used.token, used.invite.email)).ok).toBe(true);
    expect(await revokeInvite(used.invite.id, admin)).toEqual({ ok: false, error: "already_accepted" });
  });

  it("REUTILIZADO: o mesmo link não cria (nem altera) uma segunda conta — nem em dois envios simultâneos", async () => {
    const { invite: row, token } = await invite({ role: "freelancer" });
    expect((await accept(token, row.email)).ok).toBe(true);
    const again = await accept(token, row.email, { password: "outra-senha-2027" });
    expect(again).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
    const [user] = await db.select().from(users).where(eq(users.email, row.email));
    expect(await verifyPassword(user.passwordHash, PASSWORD)).toBe(true); // a senha da conta não foi trocada pelo link

    const race = await invite({ role: "freelancer" });
    const results = await Promise.all([accept(race.token, race.invite.email), accept(race.token, race.invite.email)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.email, race.invite.email))).toHaveLength(1);
  });

  it("E-MAIL DIVERGENTE: o link só serve para o e-mail convidado (e a resposta não revela o motivo)", async () => {
    const { invite: row, token } = await invite({ role: "cliente", clientId });
    const intruder = email("intruso");
    expect(await accept(token, intruder)).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
    expect(await accept(token, "")).toEqual({ ok: false, error: "invalid", message: INVITE_INVALID_MESSAGE });
    expect(await db.select().from(users).where(eq(users.email, intruder))).toHaveLength(0);
    // o convite continua valendo para a pessoa certa (maiúsculas e espaços não atrapalham)
    expect((await accept(token, `  ${row.email.toUpperCase()} `)).ok).toBe(true);
  });

  it("política de senha e nome: mesma regra do resto do sistema; o convite não é gasto por um erro de digitação", async () => {
    const { invite: row, token } = await invite({ role: "freelancer" });
    for (const password of ["curta1", "semnumeroalgum", "1234567890", "aaaaaaaaaaaa"]) {
      const result = await accept(token, row.email, { password });
      expect(result.ok, password).toBe(false);
      if (!result.ok) expect(result.error).toBe("weak_password");
    }
    const noName = await accept(token, row.email, { name: "   " });
    expect(!noName.ok && noName.error).toBe("invalid_name");
    expect((await getPendingInvite(token))?.email).toBe(row.email);
    expect((await accept(token, row.email)).ok).toBe(true);
  });

  it("se o e-mail ganhou conta por outro caminho, o convite não cria outra", async () => {
    const { invite: row, token } = await invite({ role: "freelancer" });
    const [existing] = await db.insert(users).values({ name: "[Teste] Já existe", email: row.email, passwordHash: "x", role: "gestor" }).returning({ id: users.id });
    createdUserIds.push(existing.id);
    const result = await accept(token, row.email);
    expect(!result.ok && result.error).toBe("email_taken");
    const rows = await db.select().from(users).where(eq(users.email, row.email));
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("gestor"); // a conta existente não foi tocada
  });

  it("limite de tentativas por IP (10 a cada 15 minutos), como no link de redefinição de senha", async () => {
    const attacker = { ipBucket: "198.51.100.77" };
    for (let i = 0; i < 10; i++) {
      const result = await acceptInvite({ token: `chute-${i}-${"x".repeat(40)}`, email: email("chute"), name: "[Teste] Chute", password: PASSWORD }, attacker);
      expect(!result.ok && result.error).toBe("invalid");
    }
    const { invite: row, token } = await invite({ role: "freelancer" });
    const blocked = await acceptInvite({ token, email: row.email, name: "[Teste] Bloqueada", password: PASSWORD }, attacker);
    expect(!blocked.ok && blocked.error).toBe("rate_limited");
    expect(await db.select().from(users).where(eq(users.email, row.email))).toHaveLength(0);
    // de outro IP, a pessoa convidada entra normalmente
    expect((await accept(token, row.email)).ok).toBe(true);
  });
});

describe("convites e exportação de dados", () => {
  it("a exportação completa não leva os convites (nem hash de token)", async () => {
    const { token } = await invite({ role: "freelancer" });
    const { json } = await exportAllJson(new Date());
    const payload = JSON.parse(json);
    expect(payload.tabelas.user_invites).toBeUndefined();
    expect(json).not.toContain(hashToken(token));
    expect(json).not.toMatch(/token_?hash/i);
    // os vínculos de acesso são dados de negócio e saem
    expect(Object.keys(payload.tabelas)).toEqual(expect.arrayContaining(["project_members", "client_users"]));
  });
});
