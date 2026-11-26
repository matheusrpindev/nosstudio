import "server-only";
import { and, desc, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { env } from "@/lib/env";
import { parseOverrides, type PermissionOverrides } from "@/lib/permissions/matrix";
import { pruneRateLimits } from "./rate-limit";
import { deviceToken, generateToken, hasDeviceToken, hashToken, withDeviceToken } from "./tokens";

const secureCookies = env.isProd || env.siteUrl.startsWith("https://");
/** Prefixo __Host-: o navegador só aceita o cookie com Secure, Path=/ e sem Domain (bloqueia injeção por subdomínio). */
export const SESSION_COOKIE = secureCookies ? "__Host-nos_session" : "nos_session";

const DAY = 24 * 60 * 60 * 1000;
/** A sessão expira após 30 dias sem uso… */
const IDLE_LIFETIME = 30 * DAY;
/** …e é renovada quando faltar menos da metade disso. */
const RENEW_THRESHOLD = 15 * DAY;
/** Máximo de sessões abertas por conta: ao entrar, as mais antigas além deste número são encerradas. */
export const MAX_SESSIONS_PER_USER = 10;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "lax" as const,
  path: "/",
  maxAge: IDLE_LIFETIME / 1000,
};

// ------------------------------------------------------------ aparelho conhecido
/** Cookie de "aparelho conhecido" (ver `deviceToken` em ./tokens). Não é credencial: só afeta o limitador de login. */
const DEVICE_COOKIE = secureCookies ? "__Host-nos_device" : "nos_device";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // teto aceito pelos navegadores

/** Este navegador já entrou nesta conta antes (ou redefiniu a senha dela pelo link do e-mail)? */
export async function isKnownDevice(email: string): Promise<boolean> {
  return hasDeviceToken((await cookies()).get(DEVICE_COOKIE)?.value, deviceToken(email));
}

/** Marca este navegador como aparelho conhecido da conta. Só em Server Action / Route Handler. */
export async function rememberDevice(email: string): Promise<void> {
  const store = await cookies();
  store.set(DEVICE_COOKIE, withDeviceToken(store.get(DEVICE_COOKIE)?.value, deviceToken(email)), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}

/**
 * Dados do usuário que podem circular pela aplicação (sem hash de senha). `permissions` são os ajustes
 * individuais sobre a matriz do perfil — é o que `can(user, módulo, ação)` precisa (src/lib/permissions).
 */
export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "mustChangePassword"> & { permissions: PermissionOverrides };

/** Cria a sessão no banco e grava o cookie. Só pode ser chamado em Server Action / Route Handler. */
export async function createSession(userId: number, meta: { ip?: string; userAgent?: string } = {}) {
  const store = await cookies();
  const token = generateToken();
  const now = new Date();
  // Entrou de novo no mesmo navegador: a sessão do cookie antigo é substituída (não fica uma linha por login).
  const previous = store.get(SESSION_COOKIE)?.value;
  if (previous && previous.length <= 200) await db.delete(sessions).where(eq(sessions.id, hashToken(previous)));
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + IDLE_LIFETIME),
    lastSeenAt: now,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
  // Faxina oportunista a cada login; nenhuma falha aqui pode atrapalhar a entrada.
  await pruneSessions(userId, now).catch(() => undefined);
  await pruneRateLimits().catch(() => undefined);
}

/**
 * Faxina das sessões: apaga as vencidas (de todas as contas) e, para `userId`, mantém só as
 * `MAX_SESSIONS_PER_USER` usadas mais recentemente — as mais antigas são encerradas. Assim "Minha conta ›
 * Sessões ativas" não cresce sem fim. Devolve quantas sessões desta conta foram encerradas pelo limite.
 */
export async function pruneSessions(userId: number, now: Date = new Date(), keep = MAX_SESSIONS_PER_USER): Promise<number> {
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
  const extra = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.lastSeenAt), desc(sessions.createdAt))
    .limit(1000)
    .offset(Math.max(1, keep));
  if (extra.length === 0) return 0;
  await db.delete(sessions).where(inArray(sessions.id, extra.map((row) => row.id)));
  return extra.length;
}

/**
 * Lê e valida a sessão atual. Memorizado por requisição (React cache), então pode ser chamado
 * à vontade em layouts, páginas e actions sem repetir a consulta.
 */
export const getSession = cache(async (): Promise<{ sessionId: string; user: CurrentUser } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  // A validade da sessão depende do horário atual: com Cache Components isso precisa ser explicitamente
  // dinâmico (connection()), senão o Next tenta pré-renderizar a casca do painel e acusa `new Date()`.
  await connection();
  const sessionId = hashToken(token);
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      mustChangePassword: users.mustChangePassword,
      permissions: users.permissions,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now), eq(users.active, true)));
  if (!row) return null;

  // Renovação deslizante + "visto por último" (no máximo uma escrita a cada 5 minutos).
  const patch: Partial<typeof sessions.$inferInsert> = {};
  if (row.expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD) patch.expiresAt = new Date(now.getTime() + IDLE_LIFETIME);
  if (now.getTime() - row.lastSeenAt.getTime() > 5 * 60 * 1000) patch.lastSeenAt = now;
  if (Object.keys(patch).length > 0) {
    await db.update(sessions).set(patch).where(eq(sessions.id, sessionId));
  }

  return {
    sessionId,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      mustChangePassword: row.mustChangePassword,
      // leitura tolerante: um JSON estranho no banco vira "sem ajustes", nunca um erro de página
      permissions: parseOverrides(row.permissions),
    },
  };
});

/** Encerra a sessão atual (banco + cookie). Só em Server Action / Route Handler. */
export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete({ name: SESSION_COOKIE, path: "/", secure: secureCookies });
}

/** Encerra todas as sessões de um usuário (ex.: após trocar a senha). `exceptSessionId` preserva a atual. */
export async function destroyUserSessions(userId: number, exceptSessionId?: string) {
  await db
    .delete(sessions)
    .where(exceptSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)) : eq(sessions.userId, userId));
}
