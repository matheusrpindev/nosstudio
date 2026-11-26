import "server-only";
import { countUnread, listNotifications } from "@/server/notifications";
import type { NotificationSummary } from "./shared";

/** O que o sino mostra: quantas não lidas e as mais recentes — SÓ da pessoa `userId`. */
export async function getNotificationSummary(userId: number, limit = 8): Promise<NotificationSummary> {
  const [unread, rows] = await Promise.all([countUnread(userId), listNotifications(userId, { limit })]);
  return { unread, items: rows.map((row) => ({ id: row.id, title: row.title, body: row.body, href: row.href, read: row.readAt !== null, createdAt: row.createdAt.toISOString() })) };
}
