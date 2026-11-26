import { notFound } from "next/navigation";
import { requirePanelUser } from "@/lib/auth";

export const instant = false;

/**
 * Qualquer endereço do painel que não tenha página própria cai aqui e mostra o `not-found.tsx` do painel
 * DENTRO do shell (sem isto, o Next usaria a página 404 geral do site). Rotas reais têm prioridade sobre esta.
 */
export default async function PainelCatchAll() {
  await requirePanelUser();
  notFound();
}
