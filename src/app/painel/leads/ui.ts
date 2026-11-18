/**
 * Apresentação dos leads compartilhada entre as telas do módulo (lista, detalhe).
 * Os RÓTULOS vêm de `src/lib/domain.ts`; aqui ficam só os TONS de cada status (decisão visual do módulo).
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { LeadStatus } from "@/lib/domain";

export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  novo: "lima",
  em_atendimento: "roxo",
  convertido: "sucesso",
  descartado: "neutral",
};
