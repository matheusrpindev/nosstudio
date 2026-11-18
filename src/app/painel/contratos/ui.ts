/** Tons dos status de contrato (os rótulos vêm de `src/lib/domain.ts`). */
import type { BadgeTone } from "@/components/ui/badge";
import type { ContractStatus } from "@/lib/domain";

export const CONTRACT_STATUS_TONES: Record<ContractStatus, BadgeTone> = {
  rascunho: "neutral",
  enviado: "alerta",
  assinado: "sucesso",
  encerrado: "roxo",
  cancelado: "perigo",
};

/** Aviso fixo exibido nas telas de contrato e de modelo. */
export const LEGAL_REVIEW_NOTICE = "A redação jurídica precisa ser revisada por um(a) advogado(a) antes do uso.";
