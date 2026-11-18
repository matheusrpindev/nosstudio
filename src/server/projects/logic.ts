/**
 * Regras puras do módulo de Projetos (sem banco, sem servidor): prazos, tipo de serviço por modalidade, links de entrega.
 * Fica separado de `admin.ts` para poder ser testado com vitest e usado também em componentes.
 */
import type { LabeledLink } from "@/db/schema";
import { diffDays, type ISODate } from "@/lib/dates";
import { PROJECT_OPEN_STAGES, type ProjectStage, type ProposalModality, type ServiceInterest } from "@/lib/domain";
import { safeUrl } from "@/lib/format";

/** Colunas do quadro, na ordem do fluxo. "Cancelado" fica fora do quadro (lista à parte). */
export const BOARD_STAGES = ["briefing", "planejamento", "gravacao", "edicao", "revisao", "entregue"] as const satisfies readonly ProjectStage[];

export const isOpenStage = (stage: ProjectStage): boolean => PROJECT_OPEN_STAGES.includes(stage);

/** Dias à frente que contam como "esta semana". */
export const WEEK_WINDOW_DAYS = 7;

export type DeadlineStatus =
  | { kind: "none" }
  | { kind: "atrasado"; days: number }
  | { kind: "hoje" }
  | { kind: "semana"; days: number }
  | { kind: "ok"; days: number };

/** Situação do prazo de entrega. Projetos entregues ou cancelados nunca aparecem como atrasados. */
export function deadlineStatus(deadline: ISODate | null | undefined, stage: ProjectStage, today: ISODate): DeadlineStatus {
  if (!deadline || !isOpenStage(stage)) return { kind: "none" };
  const days = diffDays(today, deadline); // positivo = no futuro
  if (days < 0) return { kind: "atrasado", days: -days };
  if (days === 0) return { kind: "hoje" };
  if (days <= WEEK_WINDOW_DAYS) return { kind: "semana", days };
  return { kind: "ok", days };
}

/** Texto curto do destaque de prazo ("Atrasado há 3 dias", "Entrega amanhã"…). `null` quando não há o que destacar. */
export function deadlineLabel(status: DeadlineStatus): string | null {
  switch (status.kind) {
    case "atrasado":
      return status.days === 1 ? "Atrasado há 1 dia" : `Atrasado há ${status.days} dias`;
    case "hoje":
      return "Entrega hoje";
    case "semana":
      return status.days === 1 ? "Entrega amanhã" : `Entrega em ${status.days} dias`;
    default:
      return null;
  }
}

/** Ao criar projeto a partir de uma proposta: modalidade → tipo de serviço. */
export const SERVICE_BY_MODALITY: Record<ProposalModality, ServiceInterest> = {
  mensal: "pacote_mensal",
  diaria_evento: "eventos",
  casamento: "casamentos",
  personalizada: "outro",
};

export type ProjectLinkFields = {
  driveUrl: string;
  galleryUrl: string;
  referencesUrl: string;
  finalFilesUrl: string;
  links: readonly LabeledLink[];
};

export type ProjectLinkEntry = { key: string; label: string; url: string };

/** Todos os links de arquivos de um projeto, já validados com `safeUrl` (links inválidos somem), na ordem de exibição. */
export function projectLinkEntries(project: ProjectLinkFields): ProjectLinkEntry[] {
  const fixed: [string, string, string][] = [
    ["drive", "Pasta no Google Drive", project.driveUrl],
    ["galeria", "Galeria", project.galleryUrl],
    ["referencias", "Referências", project.referencesUrl],
    ["finais", "Arquivos finais", project.finalFilesUrl],
  ];
  const entries: ProjectLinkEntry[] = [];
  for (const [key, label, raw] of fixed) {
    const url = safeUrl(raw);
    if (url) entries.push({ key, label, url });
  }
  (project.links ?? []).forEach((link, index) => {
    const url = safeUrl(link?.url);
    if (url) entries.push({ key: `extra-${index}`, label: link.label?.trim() || "Link", url });
  });
  return entries;
}

/** Nome curto do site de um link, para mostrar ao lado do botão "Abrir" (`drive.google.com`). */
export function linkHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Ao marcar como "Entregue" sem data de entrega, a data é hoje; nos demais casos, mantém o que já existe. */
export function resolveDeliveredAt(stage: ProjectStage, deliveredAt: ISODate | null | undefined, today: ISODate): ISODate | null {
  if (stage === "entregue" && !deliveredAt) return today;
  return deliveredAt || null;
}

export type ChecklistProgress = { done: number; total: number };

export function checklistProgress(items: readonly { done: boolean }[] | null | undefined): ChecklistProgress {
  const list = items ?? [];
  return { done: list.filter((item) => item.done).length, total: list.length };
}
