import "server-only";
import { updateTag } from "next/cache";

/** Tag única de todo o conteúdo público. Qualquer alteração feita no painel que apareça no site a invalida. */
export const SITE_TAG = "site";

/**
 * Chame em toda Server Action que altera algo visível no site público (textos, serviços, pacotes, FAQ,
 * avisos, portfólio, depoimentos, mídia usada no site). A próxima visita já vê a versão nova.
 */
export function invalidateSite() {
  updateTag(SITE_TAG);
}
