import "server-only";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { countRecords } from "./data";

/** Números do índice de Configurações. */
export async function getAuditSummary(): Promise<{ activeUsers: number; auditEntries: number; totalRecords: number }> {
  const [[active], [audit], records] = await Promise.all([
    db.select({ total: count() }).from(users).where(eq(users.active, true)),
    db.select({ total: count() }).from(auditLog),
    countRecords(),
  ]);
  return { activeUsers: active.total, auditEntries: audit.total, totalRecords: records.reduce((sum, row) => sum + row.total, 0) };
}

/** Usuários ativos (destinatários padrão dos avisos). */
export async function listActiveRecipients(): Promise<{ id: number; name: string; email: string }[]> {
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.active, true)).orderBy(users.name);
}
