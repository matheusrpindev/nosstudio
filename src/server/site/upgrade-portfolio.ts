/**
 * Categorias do portfólio no briefing v2 (seção 08), para bancos JÁ CRIADOS: a categoria "videos" passou a se
 * chamar "audiovisual" (as demais — fotografia, marketing, eventos, casamentos — continuam; "design" e
 * "identidade_visual" são novas e não têm registro antigo para converter).
 *
 * Idempotente: só toca projetos que ainda estão com o nome antigo; rodar de novo não muda nada. Não mexe em
 * mais nenhum campo do projeto (título, textos, publicação, ordem).
 *
 * Roda no `npm run db:seed` (logo, em todo `db:setup` / start de produção), no mesmo padrão de
 * `upgrade-v2.ts`. Teste: upgrade-portfolio.db.test.ts.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { portfolioProjects } from "@/db/schema";
import type { PortfolioCategory } from "@/lib/domain";

/** Nomes de categoria que deixaram de existir → o nome atual. */
export const PORTFOLIO_CATEGORY_RENAMES: Readonly<Record<string, PortfolioCategory>> = { videos: "audiovisual" };

/** Devolve quantos projetos mudaram de categoria. */
export async function upgradePortfolioCategories(): Promise<number> {
  let updated = 0;
  for (const [from, to] of Object.entries(PORTFOLIO_CATEGORY_RENAMES)) {
    // `from` não está mais no enum da coluna: a comparação vai em SQL puro
    const rows = await db
      .update(portfolioProjects)
      .set({ category: to })
      .where(sql`${portfolioProjects.category} = ${from}`)
      .returning({ id: portfolioProjects.id });
    updated += rows.length;
  }
  return updated;
}
