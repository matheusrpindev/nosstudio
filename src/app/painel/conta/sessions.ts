import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";

export type AccountSession = { id: string; current: boolean; device: string; ip: string | null; lastSeenAt: Date; createdAt: Date };

/** "Chrome · Windows" a partir do user-agent (só para o usuário reconhecer o aparelho; não é detecção precisa). */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Aparelho desconhecido";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Navegador";
  const system = /iPhone|iPad|iPod/.test(userAgent)
    ? "iPhone/iPad"
    : /Android/.test(userAgent)
      ? "Android"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(userAgent)
          ? "Mac"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return system ? `${browser} · ${system}` : browser;
}

/** Sessões válidas do usuário, a atual primeiro. O id (hash do token) nunca vai para o cliente inteiro. */
export async function listUserSessions(userId: number, currentSessionId: string | undefined): Promise<AccountSession[]> {
  const rows = await db
    .select({ id: sessions.id, userAgent: sessions.userAgent, ip: sessions.ip, lastSeenAt: sessions.lastSeenAt, createdAt: sessions.createdAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
  return rows
    .map((row) => ({
      id: row.id.slice(0, 12),
      current: row.id === currentSessionId,
      device: describeUserAgent(row.userAgent),
      ip: row.ip,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

export async function getAccountDetails(userId: number) {
  const [row] = await db.select({ lastLoginAt: users.lastLoginAt, createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  return row ?? null;
}
