/**
 * Apresentação das propostas compartilhada entre as telas do módulo.
 * Os RÓTULOS vêm de `src/lib/domain.ts`; aqui ficam só os TONS de cada status.
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { ProposalStatus } from "@/lib/domain";

export const PROPOSAL_STATUS_TONES: Record<ProposalStatus, BadgeTone> = {
  rascunho: "neutral",
  enviada: "roxo",
  aceita: "sucesso",
  recusada: "perigo",
  expirada: "alerta",
};

/** "2026-007" ou "2026-007 · v2". */
export function proposalNumberLabel(number: string, version: number): string {
  return version > 1 ? `${number} · v${version}` : number;
}
