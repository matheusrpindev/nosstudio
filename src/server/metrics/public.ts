/**
 * Número do contador PÚBLICO de visitas (rodapé do site). Leitura com cache, como todo o conteúdo público: a
 * página continua estática e o número é refeito a cada poucos minutos (perfil `site`) — ou na hora, quando o painel
 * salva algo do site (`invalidateSite()`).
 *
 * Sai daqui só o total de visitas e a data em que a medição começou. Nada de visitantes do dia, páginas ou origens.
 */
import "server-only";
import { eq, min, sum } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { visitStats } from "@/db/schema";
import type { VisitCounterData } from "@/lib/metrics/counter";
import { SITE_TAG } from "@/server/site/cache";

const EMPTY: VisitCounterData = { total: 0, since: null };

export async function getPublicVisitCount(): Promise<VisitCounterData> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  try {
    const [row] = await db.select({ total: sum(visitStats.visits), since: min(visitStats.day) }).from(visitStats).where(eq(visitStats.dimension, "total"));
    return { total: Number(row?.total ?? 0), since: row?.since ?? null };
  } catch (error) {
    // durante o build o banco pode não existir ainda (mesma regra de src/server/site/queries.ts)
    console.warn("[site] não foi possível ler o contador de visitas — o bloco fica oculto.", (error as Error)?.message);
    return EMPTY;
  }
}
