import "server-only";
import { and, eq, gt, lt, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { env } from "@/lib/env";
import { generateToken, hashToken } from "./tokens";

const secureCookies = env.isProd || env.siteUrl.startsWith("https://");
/** Prefixo __Host-: o navegador só aceita o cookie com Secure, Path=/ e sem Domain (bloqueia injeção por subdomínio). */
export const SESSION_COOKIE = secureCookies ? "__Host-nos_session" : "nos_session";

const DAY = 24 * 60 * 60 * 1000;
/** A sessão expira após 30 dias sem uso… */
const IDLE_LIFETIME = 30 * DAY;
/** …e é renovada quando faltar menos da metade disso. */
const RENEW_THRESHOLD = 15 * DAY;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "lax" as const,
  path: "/",
  maxAge: IDLE_LIFETIME / 1000,
};

/** Dados do usuário que podem circular pela aplicação (sem hash de senha). */
export type CurrentUser = Pick<User, "id" | "name" | "email" | "role" | "mustChangePassword">;

/** Cria a sessão no banco e grava o cookie. Só pode ser chamado em Server Action / Route Handler. */
export async function createSession(userId: number, meta: { ip?: string; userAgent?: string } = {}) {
  const token = generateToken();
  const now = new Date();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt: new Date(now.getTime() + IDLE_LIFETIME),
    lastSeenAt: now,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
  // limpeza oportunista de sessões vencidas
  await db.delete(sessions).where(lt(sessions.expiresAt, now));
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
    user: { id: row.id, name: row.name, email: row.email, role: row.role, mustChangePassword: row.mustChangePassword },
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
