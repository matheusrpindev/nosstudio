/**
 * Listas curtas para campos de seleção do painel (cliente, responsável, projeto, proposta).
 * Compartilhado entre os módulos para todos usarem os mesmos rótulos e a mesma ordenação.
 */
import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, proposals, users } from "@/db/schema";

export type Option = { value: number; label: string };

/** Clientes em ordem alfabética. */
export async function getClientOptions(): Promise<Option[]> {
  const rows = await db.select({ value: clients.id, label: clients.name }).from(clients).orderBy(asc(clients.name));
  return rows;
}

/** Usuários ativos do painel (para "responsável"). */
export async function getUserOptions(): Promise<Option[]> {
  const rows = await db
    .select({ value: users.id, label: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));
  return rows;
}

/** Projetos (mais recentes primeiro), opcionalmente de um cliente. */
export async function getProjectOptions(clientId?: number | null): Promise<Option[]> {
  const query = db.select({ value: projects.id, label: projects.title }).from(projects).$dynamic();
  const rows = await (clientId ? query.where(eq(projects.clientId, clientId)) : query).orderBy(desc(projects.id));
  return rows;
}

/** Propostas (sem modelos), mais recentes primeiro: "2026-007 — Cobertura de casamento". */
export async function getProposalOptions(clientId?: number | null): Promise<Option[]> {
  const rows = await db
    .select({ value: proposals.id, number: proposals.number, version: proposals.version, title: proposals.title, clientId: proposals.clientId })
    .from(proposals)
    .where(eq(proposals.isTemplate, false))
    .orderBy(desc(proposals.id));
  return rows
    .filter((row) => !clientId || row.clientId === clientId)
    .map((row) => ({ value: row.value, label: `${row.number}${row.version > 1 ? ` v${row.version}` : ""} — ${row.title}` }));
}
