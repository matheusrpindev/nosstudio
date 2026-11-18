/**
 * Contratos no PAINEL: documentos (`isTemplate = false`) e modelos de texto (`isTemplate = true`) na mesma tabela.
 * Só fala com o banco: recebe dados já validados. Autorização, zod e auditoria ficam nas Server Actions.
 */
import "server-only";
import { and, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, contracts, projects, proposals, type Contract } from "@/db/schema";
import type { ContractKind, ContractStatus } from "@/lib/domain";
import { deleteMedia, findMediaUsage, getMediaById } from "@/server/media";

export const CONTRACTS_PAGE_SIZE = 20;

const likePattern = (term: string) => `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

// ------------------------------------------------------------------ consultas
export type ContractFilters = {
  kind?: ContractKind;
  status?: ContractStatus;
  clientId?: number;
  q?: string;
  page?: number;
};

export type ContractListItem = Pick<Contract, "id" | "title" | "kind" | "status" | "versionLabel" | "signedAt" | "validUntil" | "clientId"> & {
  clientName: string | null;
  hasFile: boolean;
};

function contractWhere(filters: ContractFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [eq(contracts.isTemplate, false)];
  if (filters.kind) conditions.push(eq(contracts.kind, filters.kind));
  if (filters.status) conditions.push(eq(contracts.status, filters.status));
  if (filters.clientId) conditions.push(eq(contracts.clientId, filters.clientId));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const text = likePattern(q.toLowerCase());
    conditions.push(or(sql`lower(${contracts.title}) like ${text} escape '\\'`, sql`lower(coalesce(${clients.name}, '')) like ${text} escape '\\'`));
  }
  return and(...conditions);
}

/** Lista paginada, mais recentes primeiro. */
export async function listContracts(filters: ContractFilters = {}): Promise<{ rows: ContractListItem[]; total: number; page: number; pageSize: number }> {
  const where = contractWhere(filters);
  const [{ total }] = await db.select({ total: count() }).from(contracts).leftJoin(clients, eq(clients.id, contracts.clientId)).where(where);
  const pageCount = Math.max(1, Math.ceil(total / CONTRACTS_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({
      id: contracts.id,
      title: contracts.title,
      kind: contracts.kind,
      status: contracts.status,
      versionLabel: contracts.versionLabel,
      signedAt: contracts.signedAt,
      validUntil: contracts.validUntil,
      clientId: contracts.clientId,
      clientName: clients.name,
      fileMediaId: contracts.fileMediaId,
      externalUrl: contracts.externalUrl,
    })
    .from(contracts)
    .leftJoin(clients, eq(clients.id, contracts.clientId))
    .where(where)
    .orderBy(desc(contracts.updatedAt), desc(contracts.id))
    .limit(CONTRACTS_PAGE_SIZE)
    .offset((page - 1) * CONTRACTS_PAGE_SIZE);
  return {
    rows: rows.map(({ fileMediaId, externalUrl, ...row }) => ({ ...row, hasFile: fileMediaId !== null || externalUrl !== "" })),
    total,
    page,
    pageSize: CONTRACTS_PAGE_SIZE,
  };
}

export type ContractDetail = Contract & {
  client: { id: number; name: string } | null;
  project: { id: number; title: string } | null;
  proposal: { id: number; number: string; title: string } | null;
};

export async function getContract(id: number): Promise<ContractDetail | null> {
  const [row] = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isTemplate, false)));
  if (!row) return null;
  const [client, project, proposal] = await Promise.all([
    row.clientId ? db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, row.clientId)) : [],
    row.projectId ? db.select({ id: projects.id, title: projects.title }).from(projects).where(eq(projects.id, row.projectId)) : [],
    row.proposalId ? db.select({ id: proposals.id, number: proposals.number, title: proposals.title }).from(proposals).where(eq(proposals.id, row.proposalId)) : [],
  ]);
  return { ...row, client: client[0] ?? null, project: project[0] ?? null, proposal: proposal[0] ?? null };
}

export type TemplateItem = Pick<Contract, "id" | "title" | "kind" | "versionLabel" | "body" | "updatedAt">;

export async function listTemplates(): Promise<TemplateItem[]> {
  return db
    .select({ id: contracts.id, title: contracts.title, kind: contracts.kind, versionLabel: contracts.versionLabel, body: contracts.body, updatedAt: contracts.updatedAt })
    .from(contracts)
    .where(eq(contracts.isTemplate, true))
    .orderBy(contracts.kind, contracts.title);
}

export async function getTemplate(id: number): Promise<Contract | null> {
  const [row] = await db.select().from(contracts).where(and(eq(contracts.id, id), eq(contracts.isTemplate, true)));
  return row ?? null;
}

/** Vínculos sugeridos ao começar um contrato a partir de um projeto ou proposta. */
export async function getLinkDefaults(input: { projectId?: number; proposalId?: number }): Promise<{ clientId: number | null; projectId: number | null; proposalId: number | null; title: string }> {
  let clientId: number | null = null;
  let projectId: number | null = null;
  let proposalId: number | null = null;
  let title = "";
  if (input.projectId) {
    const [project] = await db.select({ id: projects.id, clientId: projects.clientId, title: projects.title }).from(projects).where(eq(projects.id, input.projectId));
    if (project) {
      projectId = project.id;
      clientId = project.clientId;
      title = project.title;
    }
  }
  if (input.proposalId) {
    const [proposal] = await db.select({ id: proposals.id, clientId: proposals.clientId, title: proposals.title }).from(proposals).where(and(eq(proposals.id, input.proposalId), eq(proposals.isTemplate, false)));
    if (proposal) {
      proposalId = proposal.id;
      clientId ??= proposal.clientId;
      title ||= proposal.title;
    }
  }
  return { clientId, projectId, proposalId, title };
}

// ------------------------------------------------------------------ mutações
export type ContractInput = {
  title: string;
  kind: ContractKind;
  body: string;
  versionLabel: string;
  clientId: number | null;
  projectId: number | null;
  proposalId: number | null;
  status: ContractStatus;
  signedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  fileMediaId: number | null;
  externalUrl: string;
  notes: string;
};

/** O arquivo do contrato tem de ser um upload PRIVADO existente (nunca uma imagem pública do site). */
export async function isPrivateMedia(mediaId: number): Promise<boolean> {
  const row = await getMediaById(mediaId);
  return row?.visibility === "private";
}

/** Apaga o arquivo se ele ficou sem uso depois de um desvínculo/exclusão. */
async function releaseMedia(mediaId: number | null | undefined): Promise<void> {
  if (!mediaId) return;
  if ((await findMediaUsage(mediaId)).length === 0) await deleteMedia(mediaId);
}

export async function createContract(input: ContractInput): Promise<Contract> {
  const [row] = await db.insert(contracts).values({ ...input, isTemplate: false }).returning();
  return row;
}

export async function updateContract(id: number, input: ContractInput): Promise<Contract | null> {
  const existing = await getContract(id);
  if (!existing) return null;
  const [row] = await db.update(contracts).set({ ...input, updatedAt: new Date() }).where(eq(contracts.id, id)).returning();
  if (existing.fileMediaId && existing.fileMediaId !== input.fileMediaId) await releaseMedia(existing.fileMediaId);
  return row ?? null;
}

export async function setContractStatus(id: number, status: ContractStatus): Promise<Contract | null> {
  const [row] = await db
    .update(contracts)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(contracts.id, id), eq(contracts.isTemplate, false)))
    .returning();
  return row ?? null;
}

export async function deleteContract(id: number): Promise<Contract | null> {
  const existing = await getContract(id);
  if (!existing) return null;
  await db.delete(contracts).where(eq(contracts.id, id));
  await releaseMedia(existing.fileMediaId);
  return existing;
}

export type TemplateInput = { title: string; kind: ContractKind; versionLabel: string; body: string };

export async function createTemplate(input: TemplateInput): Promise<Contract> {
  const [row] = await db.insert(contracts).values({ ...input, isTemplate: true, status: "rascunho" }).returning();
  return row;
}

export async function updateTemplate(id: number, input: TemplateInput): Promise<Contract | null> {
  const [row] = await db
    .update(contracts)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(contracts.id, id), eq(contracts.isTemplate, true)))
    .returning();
  return row ?? null;
}

export async function deleteTemplate(id: number): Promise<Contract | null> {
  const [row] = await db
    .delete(contracts)
    .where(and(eq(contracts.id, id), eq(contracts.isTemplate, true)))
    .returning();
  return row ?? null;
}

/** Confere se cliente/projeto/proposta existem (senão a chave estrangeira derrubaria a gravação com erro genérico). */
export async function findMissingLinks(input: Pick<ContractInput, "clientId" | "projectId" | "proposalId">): Promise<Partial<Record<"clientId" | "projectId" | "proposalId", string>>> {
  const errors: Partial<Record<"clientId" | "projectId" | "proposalId", string>> = {};
  const [client, project, proposal] = await Promise.all([
    input.clientId ? db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.clientId)) : null,
    input.projectId ? db.select({ id: projects.id }).from(projects).where(eq(projects.id, input.projectId)) : null,
    input.proposalId ? db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, input.proposalId)) : null,
  ]);
  if (client && client.length === 0) errors.clientId = "Este cliente não existe mais.";
  if (project && project.length === 0) errors.projectId = "Este projeto não existe mais.";
  if (proposal && proposal.length === 0) errors.proposalId = "Esta proposta não existe mais.";
  return errors;
}
