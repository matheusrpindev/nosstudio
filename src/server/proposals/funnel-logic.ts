/**
 * Avanço automático do cliente no funil — regras puras (sem banco), cobertas por `funnel-logic.test.ts`.
 *
 * Quando uma proposta é enviada ou aceita, ou quando nasce um projeto, o cliente anda sozinho no funil:
 *   proposta enviada → "Em orçamento" · proposta aceita → "Fechado" · projeto criado → "Em produção".
 *
 * Duas travas:
 *  - só PARA A FRENTE, na ordem de `CLIENT_PIPELINE` (nunca volta uma etapa; voltar a proposta para rascunho,
 *    recusar ou expirar não mexe no cliente);
 *  - clientes fora do funil ativo ("Perdido", "Cancelado") não são tocados: quem decide reabrir é uma pessoa.
 */
import { CLIENT_PIPELINE, CLIENT_STATUS_LABELS, type ClientStatus } from "@/lib/domain";

export const FUNNEL_EVENTS = ["proposta_enviada", "proposta_aceita", "projeto_criado"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Etapa do funil a que cada acontecimento leva. */
export const FUNNEL_EVENT_TARGET: Record<FunnelEvent, ClientStatus> = {
  proposta_enviada: "em_orcamento",
  proposta_aceita: "fechado",
  projeto_criado: "em_producao",
};

/** Novo status do cliente depois do acontecimento, ou `null` se ele deve ficar onde está. */
export function funnelAdvance(current: ClientStatus, event: FunnelEvent): ClientStatus | null {
  const from = CLIENT_PIPELINE.indexOf(current);
  if (from === -1) return null; // Perdido / Cancelado: fora do funil ativo
  const target = FUNNEL_EVENT_TARGET[event];
  return CLIENT_PIPELINE.indexOf(target) > from ? target : null;
}

/**
 * Linha gravada no histórico do cliente, ex.:
 * "Status alterado automaticamente para Fechado (proposta 2026-001 aceita). Antes: Em orçamento."
 */
export function funnelAdvanceText(from: ClientStatus, to: ClientStatus, reason: string): string {
  return `Status alterado automaticamente para ${CLIENT_STATUS_LABELS[to]} (${reason}). Antes: ${CLIENT_STATUS_LABELS[from]}.`;
}

/** Complemento do aviso de sucesso da ação (sem dados pessoais: vai em toast/cookie). */
export function funnelAdvanceNotice(to: ClientStatus): string {
  return `O cliente foi movido para “${CLIENT_STATUS_LABELS[to]}” no funil.`;
}
