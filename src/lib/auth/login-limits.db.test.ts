import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { rateLimits, sessions, users } from "@/db/schema";
import { createUser } from "@/server/config/users";
import { checkLoginAttempt, clearLoginAttempts, LOGIN_RULES, loginGateMessage } from "./login-limits";
import { unlockLogin } from "./rate-limit";
import { MAX_SESSIONS_PER_USER, pruneSessions } from "./session";

/**
 * O cenário do achado: um estranho dispara dezenas de tentativas erradas contra o e-mail de um sócio, de vários
 * IPs. O que NÃO pode acontecer: o sócio, com a senha certa, ser recusado por causa disso.
 * (`checkLoginAttempt` é a porta que a action de login atravessa ANTES de conferir a senha.)
 */
const OWNER_IP = "198.51.100.10";
const attackerIp = (n: number) => `203.0.113.${n}`;
let email = "";
let run = 0;

beforeEach(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, "login:%"));
  email = `teste-limite-${Date.now()}-${run++}@nos.test`;
});
afterAll(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, "login:%"));
});

/** `total` tentativas erradas de aparelhos desconhecidos, espalhadas por vários IPs (no máximo 5 por IP). */
async function attack(total: number) {
  const results = [];
  for (let i = 0; i < total; i++) results.push(await checkLoginAttempt({ email, ipBucket: attackerIp(1 + Math.floor(i / 5)), knownDevice: false }));
  return results;
}

describe("limitador do login: tentativas de terceiros não trancam o dono", () => {
  it("as 40 primeiras tentativas espalhadas passam para a conferência da senha (que as recusa)", async () => {
    const results = await attack(LOGIN_RULES.email.limit);
    expect(results.every((result) => result.ok)).toBe(true);
  });

  it("com a conta sob ataque, o dono entra de um APARELHO CONHECIDO — sempre", async () => {
    await attack(60);
    for (let i = 0; i < 3; i++) {
      expect(await checkLoginAttempt({ email, ipBucket: OWNER_IP, knownDevice: true })).toEqual({ ok: true });
    }
  });

  it("com a conta sob ataque, o dono entra também de um aparelho NOVO (outro IP): a senha certa não é recusada", async () => {
    await attack(60);
    expect(await checkLoginAttempt({ email, ipBucket: OWNER_IP, knownDevice: false })).toEqual({ ok: true });
  });

  it("quem está atacando fica restrito: poucas tentativas por IP enquanto durar o modo restrito", async () => {
    await attack(LOGIN_RULES.email.limit); // estoura na próxima
    const ip = attackerIp(200);
    const outcomes = [];
    for (let i = 0; i < LOGIN_RULES.strictPair.limit + 2; i++) outcomes.push(await checkLoginAttempt({ email, ipBucket: ip, knownDevice: false }));
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(LOGIN_RULES.strictPair.limit);
    const blocked = outcomes.at(-1)!;
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.barrier).toBe("account");
      expect(blocked.retryAfterSeconds).toBeGreaterThan(50 * 60);
      expect(loginGateMessage(blocked, true)).toContain("Esqueci minha senha");
      expect(loginGateMessage(blocked, false)).toContain("administrador");
    }
    // …e o bloqueio daquele IP não atinge o dono, em outro IP
    expect((await checkLoginAttempt({ email, ipBucket: OWNER_IP, knownDevice: false })).ok).toBe(true);
    // …nem outra conta
    expect((await checkLoginAttempt({ email: `outra-${email}`, ipBucket: ip, knownDevice: false })).ok).toBe(true);
  });

  it("aparelho conhecido não gasta a cota da conta (o dono não entra em modo restrito por entrar muitas vezes)", async () => {
    for (let i = 0; i < 60; i++) {
      // de IPs diferentes para não esbarrar no limite por e-mail + IP
      expect((await checkLoginAttempt({ email, ipBucket: `198.51.100.${i}`, knownDevice: true })).ok).toBe(true);
    }
    const [row] = await db.select().from(rateLimits).where(like(rateLimits.key, "login:email:%"));
    expect(row).toBeUndefined();
  });

  it("força bruta comum continua barrada: 8 tentativas por e-mail + IP, 30 por IP — inclusive com aparelho conhecido", async () => {
    const outcomes = [];
    for (let i = 0; i < LOGIN_RULES.pair.limit + 1; i++) outcomes.push(await checkLoginAttempt({ email, ipBucket: OWNER_IP, knownDevice: true }));
    expect(outcomes.slice(0, LOGIN_RULES.pair.limit).every((outcome) => outcome.ok)).toBe(true);
    expect(outcomes.at(-1)).toMatchObject({ ok: false, barrier: "pair" });

    const byIp = [];
    for (let i = 0; i < LOGIN_RULES.ip.limit + 1; i++) byIp.push(await checkLoginAttempt({ email: `conta-${i}-${email}`, ipBucket: "198.51.100.77", knownDevice: false }));
    expect(byIp.at(-1)).toMatchObject({ ok: false, barrier: "ip" });
    expect(loginGateMessage(byIp.at(-1) as never, true)).toMatch(/^Muitas tentativas\. /);
  });

  it("login certo zera os contadores da conta; unlockLogin tira a conta do modo restrito na hora", async () => {
    await attack(60);
    const ip = attackerIp(201);
    for (let i = 0; i < LOGIN_RULES.strictPair.limit + 1; i++) await checkLoginAttempt({ email, ipBucket: ip, knownDevice: false });
    expect((await checkLoginAttempt({ email, ipBucket: ip, knownDevice: false })).ok).toBe(false);

    // destravar (redefinição de senha concluída / senha nova gerada pelo admin / --unlock) encerra o modo restrito
    await unlockLogin(email);
    expect((await checkLoginAttempt({ email, ipBucket: ip, knownDevice: false })).ok).toBe(true);

    await attack(60);
    await clearLoginAttempts(email, OWNER_IP);
    const keys = (await db.select({ key: rateLimits.key }).from(rateLimits).where(like(rateLimits.key, "login:email:%"))).length;
    expect(keys).toBe(0);
  });
});

describe("sessões por conta", () => {
  const created: number[] = [];
  afterAll(async () => {
    if (created.length) await db.delete(users).where(inArray(users.id, created));
  });
  async function makeUser(tag: string) {
    const result = await createUser({ name: `[Teste] ${tag}`, email: `teste-sessao-${tag}-${Date.now()}@nos.test`, role: "admin" });
    if (!result.ok) throw new Error("falhou");
    created.push(result.user.id);
    return result.user;
  }
  const DAY = 24 * 60 * 60 * 1000;
  const addSession = (userId: number, id: string, lastSeenAgoMs: number, expiresInMs = 30 * DAY) =>
    db.insert(sessions).values({ id, userId, lastSeenAt: new Date(Date.now() - lastSeenAgoMs), expiresAt: new Date(Date.now() + expiresInMs) });
  const idsOf = async (userId: number) => (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId))).map((row) => row.id).sort();

  it("mantém só as 10 sessões usadas mais recentemente; as mais antigas são encerradas", async () => {
    const user = await makeUser("limite");
    const other = await makeUser("outra");
    for (let i = 0; i < 14; i++) await addSession(user.id, `teste-s-${user.id}-${String(i).padStart(2, "0")}`, i * 60_000);
    await addSession(other.id, `teste-s-${other.id}-a`, 20 * DAY);

    expect(await pruneSessions(user.id)).toBe(14 - MAX_SESSIONS_PER_USER);
    const left = await idsOf(user.id);
    expect(left).toHaveLength(MAX_SESSIONS_PER_USER);
    // ficaram as de uso mais recente (índices 00–09)
    expect(left).toEqual(Array.from({ length: 10 }, (_, i) => `teste-s-${user.id}-${String(i).padStart(2, "0")}`));
    // a outra conta não é afetada pelo limite desta
    expect(await idsOf(other.id)).toHaveLength(1);
    // rodar de novo não apaga mais nada
    expect(await pruneSessions(user.id)).toBe(0);
  });

  it("sessões vencidas somem (de qualquer conta) e não contam para o limite", async () => {
    const user = await makeUser("vencidas");
    const other = await makeUser("vencidas-outra");
    for (let i = 0; i < 4; i++) await addSession(user.id, `teste-v-${user.id}-${i}`, i * 60_000);
    for (let i = 0; i < 9; i++) await addSession(user.id, `teste-x-${user.id}-${i}`, 40 * DAY, -DAY);
    await addSession(other.id, `teste-x-${other.id}`, 40 * DAY, -DAY);

    expect(await pruneSessions(user.id)).toBe(0);
    expect(await idsOf(user.id)).toEqual([0, 1, 2, 3].map((i) => `teste-v-${user.id}-${i}`));
    expect(await idsOf(other.id)).toEqual([]);
  });
});
