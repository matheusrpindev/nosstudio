/**
 * CENTRAL DE NOTIFICAÇÕES do painel (briefing v2, seção 30) — a parte de banco.
 *
 * Regra de ouro: toda leitura e toda mudança leva o `userId` de QUEM ESTÁ LOGADO na cláusula WHERE. Não existe
 * função que leia ou marque uma notificação só pelo id: uma pessoa nunca alcança o aviso de outra.
 *
 * Para um módulo passar a notificar: acrescente o tipo em `NOTIFICATION_TYPES` (`src/lib/domain.ts`) e chame
 * `createNotifications([...])`. O `href` precisa ser um caminho interno do painel.
 */
import "server-only";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { notifications, type Notification } from "@/db/schema";
import type { NotificationType } from "@/lib/domain";

export type NotificationInput = { userId: number; type: NotificationType; title: string; body?: string; href?: string };
export type NotificationView = Pick<Notification, "id" | "type" | "title" | "body" | "href" | "readAt" | "createdAt">;

/** Só caminhos do próprio painel viram link (nada de URL externa nem `//host`). */
export const safeNotificationHref = (href: string | undefined): string => (href && /^\/painel(\/[^\s\\]*)?(\?[^\s\\]*)?$/.test(href) && !href.startsWith("//") ? href : "");

export async function createNotifications(inputs: readonly NotificationInput[], executor: DbOrTx = db): Promise<number> {
  if (inputs.length === 0) return 0;
  const rows = await executor
    .insert(notifications)
    .values(inputs.map((input) => ({ userId: input.userId, type: input.type, title: input.title.slice(0, 200), body: (input.body ?? "").slice(0, 500), href: safeNotificationHref(input.href) })))
    .returning({ id: notifications.id });
  return rows.length;
}

const columns = { id: notifications.id, type: notifications.type, title: notifications.title, body: notifications.body, href: notifications.href, readAt: notifications.readAt, createdAt: notifications.createdAt };

export async function countUnread(userId: number): Promise<number> {
  const [row] = await db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.value ?? 0;
}

/** As mais recentes desta pessoa (não lidas primeiro só na apresentação; aqui, por data). */
export async function listNotifications(userId: number, options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}): Promise<NotificationView[]> {
  return db
    .select(columns)
    .from(notifications)
    .where(and(eq(notifications.userId, userId), options.unreadOnly ? isNull(notifications.readAt) : undefined))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(Math.min(options.limit ?? 20, 100))
    .offset(options.offset ?? 0);
}

export async function countNotifications(userId: number, unreadOnly = false): Promise<number> {
  const [row] = await db.select({ value: count() }).from(notifications).where(and(eq(notifications.userId, userId), unreadOnly ? isNull(notifications.readAt) : undefined));
  return row?.value ?? 0;
}

/** Marca como lidas as notificações `ids` DESTA pessoa (ids de outras pessoas são ignorados). Devolve quantas mudaram. */
export async function markRead(userId: number, ids: readonly number[], now: Date = new Date()): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(notifications)
    .set({ readAt: now })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, [...ids]), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function markAllRead(userId: number, now: Date = new Date()): Promise<number> {
  const rows = await db.update(notifications).set({ readAt: now }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt))).returning({ id: notifications.id });
  return rows.length;
}

/** Limpeza: notificações já lidas há mais de `days` dias. */
export async function pruneReadNotifications(days = 90, now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(notifications)
    .where(lt(notifications.readAt, new Date(now.getTime() - days * 86_400_000)))
    .returning({ id: notifications.id });
  return rows.length;
}
