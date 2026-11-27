import "server-only";
import { notFound } from "next/navigation";

/**
 * A vitrine do kit (/painel/kit) é ferramenta de desenvolvimento: dados de exemplo, contas de teste e
 * formulários de demonstração. Em produção ela responde 404 (briefing v2, seção 11: "remover atalhos de
 * desenvolvimento"), a menos que `PANEL_KIT=on` esteja no ambiente (ex.: um servidor de homologação).
 * Chame DEPOIS do guarda da página.
 */
export function assertKitEnabled(): void {
  if (process.env.NODE_ENV === "production" && process.env.PANEL_KIT !== "on") notFound();
}
