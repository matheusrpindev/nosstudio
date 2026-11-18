import { eq, inArray, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { passwordResetTokens, rateLimits, users } from "@/db/schema";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/server/config/users";
import { consumeRateLimit, loginEmailKey, pruneRateLimits, unlockLogin } from "./rate-limit";
import { revokeResetTokens } from "./reset-tokens";
import { deviceToken, hasDeviceToken, withDeviceToken } from "./tokens";

const created: number[] = [];
afterAll(async () => {
  if (created.length) await db.delete(users).where(inArray(users.id, created));
  await db.delete(rateLimits).where(like(rateLimits.key, "teste:%"));
});

async function makeUser(tag: string) {
  const result = await createUser({ name: `[Teste] ${tag}`, email: `teste-${tag}-${Date.now()}@nos.test`, role: "admin" });
  if (!result.ok) throw new Error("falhou");
  created.push(result.user.id);
  return result.user;
}
const addToken = (userId: number, id: string) =>
  db.insert(passwordResetTokens).values({ id, userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
const tokensOf = (userId: number) => db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
const EMAIL_RULE = { limit: 40, windowMs: 60 * 60 * 1000 };

describe("aparelho conhecido (cookie que isenta do limite por e-mail)", () => {
  it("a marca depende da conta e não varia com maiúsculas/espaços", () => {
    expect(deviceToken("Pedro@Nos.Test ")).toBe(deviceToken("pedro@nos.test"));
    expect(deviceToken("pedro@nos.test")).not.toBe(deviceToken("laura@nos.test"));
    expect(deviceToken("pedro@nos.test")).toMatch(/^[a-f0-9]{32}$/);
  });

  it("reconhece só a marca certa; valores forjados ou vazios não passam", () => {
    const pedro = deviceToken("pedro@nos.test");
    const laura = deviceToken("laura@nos.test");
    const cookie = withDeviceToken(withDeviceToken(null, pedro), laura);
    expect(hasDeviceToken(cookie, pedro)).toBe(true);
    expect(hasDeviceToken(cookie, laura)).toBe(true);
    expect(hasDeviceToken(cookie, deviceToken("outro@nos.test"))).toBe(false);
    for (const forged of [null, undefined, "", "x", "0".repeat(32), `${"f".repeat(32)}.${"0".repeat(32)}`, "a".repeat(5000)]) {
      expect(hasDeviceToken(forged, pedro)).toBe(false);
    }
  });

  it("o cookie não repete a marca e guarda no máximo 4 contas", () => {
    const tokens = ["a", "b", "c", "d", "e"].map((name) => deviceToken(`${name}@nos.test`));
    let cookie = "";
    for (const token of tokens) cookie = withDeviceToken(cookie, token);
    cookie = withDeviceToken(cookie, tokens[4]);
    expect(cookie.split(".")).toHaveLength(4);
    expect(hasDeviceToken(cookie, tokens[4])).toBe(true);
    expect(hasDeviceToken(cookie, tokens[0])).toBe(false);
  });
});

describe("bloqueio do login por e-mail", () => {
  it("estourar o limite bloqueia; unlockLogin destrava na hora", async () => {
    const email = `teste-bloqueio-${Date.now()}@nos.test`;
    const key = loginEmailKey(email);
    for (let i = 0; i < 40; i++) expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(true);
    expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(false);
    expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(false);
    await unlockLogin(email.toUpperCase());
    expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(true);
    await unlockLogin(email);
  });

  it("senha gerada pelo administrador destrava a conta e invalida links de redefinição pendentes", async () => {
    const user = await makeUser("admin-reset");
    const key = loginEmailKey(user.email);
    for (let i = 0; i < 41; i++) await consumeRateLimit(key, EMAIL_RULE);
    expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(false);
    await addToken(user.id, `teste-token-a-${user.id}`);

    expect((await resetUserPassword(user.id)).ok).toBe(true);
    expect(await tokensOf(user.id)).toHaveLength(0);
    expect((await consumeRateLimit(key, EMAIL_RULE)).ok).toBe(true);
    await unlockLogin(user.email);
  });
});

describe("links de redefinição pedidos antes deixam de valer", () => {
  it("ao desativar a conta", async () => {
    const user = await makeUser("desativar");
    await makeUser("outro-admin"); // para não ser o último administrador ativo
    await addToken(user.id, `teste-token-b-${user.id}`);
    expect((await setUserActive(user.id, false)).ok).toBe(true);
    expect(await tokensOf(user.id)).toHaveLength(0);
  });

  it("ao mudar o e-mail da conta (mas não ao mudar só o nome)", async () => {
    const user = await makeUser("email");
    await addToken(user.id, `teste-token-c-${user.id}`);
    await updateUser(user.id, { name: "[Teste] Novo nome", email: user.email, role: "admin" });
    expect(await tokensOf(user.id)).toHaveLength(1);
    await updateUser(user.id, { name: "[Teste] Novo nome", email: `novo-${user.email}`, role: "admin" });
    expect(await tokensOf(user.id)).toHaveLength(0);
  });

  it("revokeResetTokens só mexe na conta indicada", async () => {
    const [a, b] = [await makeUser("rev-a"), await makeUser("rev-b")];
    await addToken(a.id, `teste-token-d-${a.id}`);
    await addToken(b.id, `teste-token-d-${b.id}`);
    await revokeResetTokens(a.id);
    expect(await tokensOf(a.id)).toHaveLength(0);
    expect(await tokensOf(b.id)).toHaveLength(1);
  });
});

describe("limpeza do limitador", () => {
  it("apaga contadores vencidos, preserva os recentes e os que ainda têm bloqueio em vigor", async () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    await db.insert(rateLimits).values([
      { key: "teste:velho", count: 3, windowStart: new Date(now - 2 * day), blockedUntil: null },
      { key: "teste:velho-bloqueio-vencido", count: 9, windowStart: new Date(now - 3 * day), blockedUntil: new Date(now - day) },
      { key: "teste:velho-ainda-bloqueado", count: 9, windowStart: new Date(now - 2 * day), blockedUntil: new Date(now + 60_000) },
      { key: "teste:recente", count: 1, windowStart: new Date(now - 60_000), blockedUntil: null },
    ]);
    await pruneRateLimits();
    const left = (await db.select({ key: rateLimits.key }).from(rateLimits).where(like(rateLimits.key, "teste:%"))).map((row) => row.key).sort();
    expect(left).toEqual(["teste:recente", "teste:velho-ainda-bloqueado"]);
  });
});
