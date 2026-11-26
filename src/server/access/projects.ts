/**
 * O que cada perfil EXTERNO pode ler de um projeto — por lista de campos PERMITIDOS (o que não está na lista
 * não sai). Campo novo em `projects` nasce invisível para equipe e cliente até alguém incluí-lo aqui de propósito.
 *
 * Nunca saem daqui: notas internas, situação do backup, proposta de origem (valores), responsável interno,
 * links de trabalho (Drive, arquivos finais, galeria — a entrega ao cliente terá liberação explícita), dados de
 * outros membros, nada de financeiro.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectMembers, projects, type ChecklistItem, type Project } from "@/db/schema";
import type { ProjectStage, ServiceInterest } from "@/lib/domain";
import { canAccessProject, inScope, projectScope, type AccessUser } from "./scope";

/** Projeto como a EQUIPE escalada enxerga (seção 18: sem orçamento, margens ou notas da administração). */
export type TeamProjectView = {
  id: number;
  title: string;
  serviceType: ServiceInterest;
  stage: ProjectStage;
  location: string;
  eventDate: string | null;
  shootDeadline: string | null;
  deliveryDeadline: string | null;
  checklist: ChecklistItem[];
  referencesUrl: string;
  /** A participação DA PRÓPRIA pessoa (papel e o que pode) — nunca a dos colegas. */
  membership: { role: string; canEdit: boolean; canDownload: boolean; canUpload: boolean };
};

/** Projeto como o CLIENTE enxerga (seção 27: acompanhamento; arquivos só quando liberados). */
export type ClientProjectView = {
  id: number;
  title: string;
  serviceType: ServiceInterest;
  stage: ProjectStage;
  location: string;
  eventDate: string | null;
  deliveryDeadline: string | null;
  deliveredAt: string | null;
};

export function toClientProjectView(project: Project): ClientProjectView {
  return {
    id: project.id,
    title: project.title,
    serviceType: project.serviceType,
    stage: project.stage,
    location: project.location,
    eventDate: project.eventDate,
    deliveryDeadline: project.deliveryDeadline,
    deliveredAt: project.deliveredAt,
  };
}

export function toTeamProjectView(project: Project, membership: TeamProjectView["membership"]): TeamProjectView {
  return {
    id: project.id,
    title: project.title,
    serviceType: project.serviceType,
    stage: project.stage,
    location: project.location,
    eventDate: project.eventDate,
    shootDeadline: project.shootDeadline,
    deliveryDeadline: project.deliveryDeadline,
    checklist: project.checklist,
    referencesUrl: project.referencesUrl,
    membership,
  };
}

/** Área do Cliente: o projeto `projectId`, se for de um cliente vinculado a esta conta. Senão `null` (404). */
export async function getClientProjectView(user: AccessUser, projectId: number): Promise<ClientProjectView | null> {
  if (user.role !== "cliente" || !(await canAccessProject(user, projectId, "ver"))) return null;
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  return project ? toClientProjectView(project) : null;
}

/** Área do Cliente: todos os projetos dos clientes vinculados a esta conta. */
export async function listClientProjectViews(user: AccessUser): Promise<ClientProjectView[]> {
  if (user.role !== "cliente") return [];
  const scope = await projectScope(user);
  if (scope === "todos" || scope.length === 0) return []; // "todos" nunca vale para uma conta de cliente
  const rows = await db.select().from(projects).where(inScope(projects.id, scope)).orderBy(asc(projects.id));
  return rows.map(toClientProjectView);
}

/** Área da Equipe: o projeto `projectId`, se a pessoa for membro com "ver". Senão `null` (404). */
export async function getTeamProjectView(user: AccessUser, projectId: number): Promise<TeamProjectView | null> {
  if (user.role === "cliente" || !Number.isInteger(projectId) || projectId <= 0) return null;
  const [row] = await db
    .select({ project: projects, member: projectMembers })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id), eq(projectMembers.canView, true)));
  if (!row) return null;
  const { role, canEdit, canDownload, canUpload } = row.member;
  return toTeamProjectView(row.project, { role, canEdit, canDownload, canUpload });
}

/** Área da Equipe: os projetos em que a pessoa é membro (com "ver"). */
export async function listTeamProjectViews(user: AccessUser): Promise<TeamProjectView[]> {
  if (user.role === "cliente") return [];
  const rows = await db
    .select({ project: projects, member: projectMembers })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.userId, user.id), eq(projectMembers.canView, true)))
    .orderBy(asc(projects.id));
  return rows.map(({ project, member }) => toTeamProjectView(project, { role: member.role, canEdit: member.canEdit, canDownload: member.canDownload, canUpload: member.canUpload }));
}
