/**
 * Listas curtas para campos de seleção do painel (cliente, responsável, projeto, proposta).
 * Compartilhado entre os módulos para todos usarem os mesmos rótulos e a mesma ordenação.
 */
import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clients, projects, proposals, users } from "@/db/schema";
import { USER_ROLES } from "@/lib/domain";
import { hasEnvironment } from "@/lib/permissions";
import { inScope, type IdScope } from "@/server/access/scope";

export type Option = { value: number; label: string };

/** Clientes em ordem alfabética. */
export async function getClientOptions(): Promise<Option[]> {
  const rows = await db.select({ value: clients.id, label: clients.name }).from(clients).orderBy(asc(clients.name));
  return rows;
}

/** Perfis que usam o painel: só eles aparecem como "responsável" (contas de freelancer e de cliente não). */
const PANEL_ROLES = USER_ROLES.filter((role) => hasEnvironment(role, "painel"));

/** Usuários ativos do painel (para "responsável"). */
export async function getUserOptions(): Promise<Option[]> {
  const rows = await db
    .select({ value: users.id, label: users.name })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, PANEL_ROLES)))
    .orderBy(asc(users.name));
  return rows;
}

/**
 * Projetos (mais recentes primeiro), opcionalmente de um cliente. `scope` restringe aos projetos que a pessoa
 * alcança (`moduleScope`/`projectScope`); o padrão `"todos"` é para telas que já exigem o módulo inteiro.
 */
export async function getProjectOptions(clientId?: number | null, scope: IdScope = "todos"): Promise<Option[]> {
  const rows = await db
    .select({ value: projects.id, label: projects.title })
    .from(projects)
    .where(and(clientId ? eq(projects.clientId, clientId) : undefined, inScope(projects.id, scope)))
    .orderBy(desc(projects.id));
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
