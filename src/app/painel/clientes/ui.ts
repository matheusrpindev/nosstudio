/**
 * Apresentação dos clientes compartilhada entre as telas do módulo.
 * Os RÓTULOS vêm de `src/lib/domain.ts`; aqui ficam só os TONS (decisão visual do módulo).
 */
import type { BadgeTone } from "@/components/ui/badge";
import type { ClientStatus, InteractionKind, ProposalStatus } from "@/lib/domain";

export const CLIENT_STATUS_TONES: Record<ClientStatus, BadgeTone> = {
  novo_contato: "lima",
  em_orcamento: "roxo",
  negociacao: "alerta",
  fechado: "sucesso",
  em_producao: "roxo",
  finalizado: "neutral",
  perdido: "perigo",
  cancelado: "neutral",
};

export const INTERACTION_TONES: Record<InteractionKind, BadgeTone> = {
  nota: "neutral",
  whatsapp: "sucesso",
  ligacao: "roxo",
  reuniao: "roxo",
  email: "neutral",
  status: "lima",
};

export const PROPOSAL_STATUS_TONES: Record<ProposalStatus, BadgeTone> = {
  rascunho: "neutral",
  enviada: "roxo",
  aceita: "sucesso",
  recusada: "perigo",
  expirada: "alerta",
};
