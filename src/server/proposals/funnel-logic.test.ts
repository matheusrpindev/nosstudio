import { describe, expect, it } from "vitest";
import { CLIENT_PIPELINE, CLIENT_STATUSES, type ClientStatus } from "@/lib/domain";
import { FUNNEL_EVENT_TARGET, FUNNEL_EVENTS, funnelAdvance, funnelAdvanceNotice, funnelAdvanceText, type FunnelEvent } from "./funnel-logic";

/** Tabela completa: status atual × acontecimento → novo status (`null` = não mexe). */
const TABLE: Record<ClientStatus, Record<FunnelEvent, ClientStatus | null>> = {
  novo_contato: { proposta_enviada: "em_orcamento", proposta_aceita: "fechado", projeto_criado: "em_producao" },
  em_orcamento: { proposta_enviada: null, proposta_aceita: "fechado", projeto_criado: "em_producao" },
  negociacao: { proposta_enviada: null, proposta_aceita: "fechado", projeto_criado: "em_producao" },
  fechado: { proposta_enviada: null, proposta_aceita: null, projeto_criado: "em_producao" },
  em_producao: { proposta_enviada: null, proposta_aceita: null, projeto_criado: null },
  finalizado: { proposta_enviada: null, proposta_aceita: null, projeto_criado: null },
  perdido: { proposta_enviada: null, proposta_aceita: null, projeto_criado: null },
  cancelado: { proposta_enviada: null, proposta_aceita: null, projeto_criado: null },
};

describe("avanço automático no funil", () => {
  for (const status of CLIENT_STATUSES) {
    for (const event of FUNNEL_EVENTS) {
      const expected = TABLE[status][event];
      it(`${status} + ${event} → ${expected ?? "fica onde está"}`, () => {
        expect(funnelAdvance(status, event)).toBe(expected);
      });
    }
  }

  it("nunca retrocede nem sai do funil ativo", () => {
    for (const status of CLIENT_STATUSES) {
      for (const event of FUNNEL_EVENTS) {
        const next = funnelAdvance(status, event);
        if (next === null) continue;
        expect(CLIENT_PIPELINE).toContain(status);
        expect(next).toBe(FUNNEL_EVENT_TARGET[event]);
        expect(CLIENT_PIPELINE.indexOf(next)).toBeGreaterThan(CLIENT_PIPELINE.indexOf(status));
      }
    }
  });

  it("escreve a linha do histórico e o aviso da ação", () => {
    expect(funnelAdvanceText("em_orcamento", "fechado", "proposta 2026-001 aceita")).toBe(
      "Status alterado automaticamente para Fechado (proposta 2026-001 aceita). Antes: Em orçamento.",
    );
    expect(funnelAdvanceNotice("em_producao")).toBe("O cliente foi movido para “Em produção” no funil.");
  });
});
