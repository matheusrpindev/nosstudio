/**
 * Avanço automático do cliente no funil — parte que fala com o banco (as regras estão em `funnel-logic.ts`).
 * Usado pelas mutações de propostas (enviar, aceitar, converter em projeto) e de projetos (criar).
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientInteractions, clients } from "@/db/schema";
import type { ClientStatus } from "@/lib/domain";
import { funnelAdvance, funnelAdvanceText, type FunnelEvent } from "./funnel-logic";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type FunnelMove = { clientId: number; from: ClientStatus; to: ClientStatus };

/**
 * Move o cliente para a etapa do acontecimento, se isso for um avanço (ver `funnelAdvance`), e registra a mudança
 * no histórico de atendimento. Chame DENTRO da transação da mutação que causou o avanço.
 * Devolve o movimento feito ou `null` (sem cliente, cliente fora do funil ativo ou já adiante).
 *
 * @param reason  motivo curto que vai entre parênteses no histórico, ex.: "proposta 2026-001 aceita".
 */
export async function advanceClientInFunnel(
  tx: Tx,
  input: { clientId: number | null; event: FunnelEvent; reason: string; userId: number | null; at?: Date },
): Promise<FunnelMove | null> {
  if (!input.clientId) return null;
  const [client] = await tx.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.id, input.clientId));
  if (!client) return null;
  const to = funnelAdvance(client.status, input.event);
  if (!to) return null;

  // só grava se o status ainda for o que lemos (ninguém moveu o cliente no meio do caminho)
  const [moved] = await tx
    .update(clients)
    .set({ status: to })
    .where(and(eq(clients.id, client.id), eq(clients.status, client.status)))
    .returning({ id: clients.id });
  if (!moved) return null;

  await tx.insert(clientInteractions).values({
    clientId: client.id,
    userId: input.userId,
    kind: "status",
    content: funnelAdvanceText(client.status, to, input.reason),
    ...(input.at ? { occurredAt: input.at } : {}),
  });
  return { clientId: client.id, from: client.status, to };
}
