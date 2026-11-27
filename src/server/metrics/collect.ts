/**
 * Contagem de visitas do site — medição PRÓPRIA: sem serviço de terceiros, sem cookie e sem guardar IP.
 *
 * MÉTODO (é o que a tela de métricas e o manual descrevem):
 * - VISITANTE ESTIMADO: código = HMAC(IP + navegador) com o sal aleatório do dia (ver ./salt.ts). Conta-se um
 *   visitante por código por dia. É uma estimativa: duas pessoas na mesma rede com o mesmo navegador viram uma;
 *   a mesma pessoa no celular e no computador vira duas; e quem volta em outro dia conta de novo.
 * - VISITA: sequência de páginas do mesmo visitante sem ficar mais de 30 minutos parado (`SESSION_IDLE_MS`).
 *   Recarregar ou navegar dentro desse intervalo NÃO abre outra visita (deduplicação por sessão). A visita não
 *   atravessa a meia-noite (o código do visitante muda com o sal).
 * - Origem, campanha e aparelho são da PRIMEIRA página da visita. Da referência fica só o domínio.
 * - O que não conta: robôs e monitores declarados, pré-carregamento, navegador sem JavaScript, quem está logado
 *   no painel, e as rotas do painel/acesso/arquivos (ver `src/app/api/visita/route.ts` e `@/lib/metrics/classify`).
 * - O que fica guardado: a sessão bruta por `VISIT_SESSION_RETENTION_DAYS` dias (sem IP) e os totais diários
 *   (`visit_stats`), agregados e anônimos, sem prazo.
 */
import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db";
import { visitSessions, visitStats } from "@/db/schema";
import { todayISO, type ISODate } from "@/lib/dates";
import type { VisitDevice, VisitDimension } from "@/lib/domain";
import { NOT_FOUND_PAGE_KEY, OTHER_KEY, SESSION_IDLE_MS, type TrackEvent, type VisitOrigin } from "@/lib/metrics/classify";
import { resolvePageKey } from "./paths";
import { pruneVisitSessions } from "./retention";
import { dailySalt, visitorHash } from "./salt";

/**
 * Limite de chaves DIFERENTES por dia nos recortes de texto livre: protege o banco de quem tentar enchê-lo com
 * endereços, domínios ou campanhas inventados. O excedente soma em `OTHER_KEY`.
 */
const DAILY_KEY_LIMITS: Partial<Record<VisitDimension, number>> = { pagina: 400, referencia: 300, campanha: 100, clique: 100, formulario: 100 };

type Increment = { visits?: number; visitors?: number; hits?: number };

/** Soma nos totais do dia (cria a linha na primeira vez). */
async function bump(tx: DbOrTx, day: ISODate, dimension: VisitDimension, key: string, add: Increment): Promise<void> {
  const limit = DAILY_KEY_LIMITS[dimension];
  let finalKey = key;
  if (limit !== undefined && key !== OTHER_KEY) {
    const where = and(eq(visitStats.day, day), eq(visitStats.dimension, dimension));
    const [existing] = await tx.select({ id: visitStats.id }).from(visitStats).where(and(where, eq(visitStats.key, key)));
    if (!existing) {
      const [{ n }] = await tx.select({ n: count() }).from(visitStats).where(where);
      if (n >= limit) finalKey = OTHER_KEY;
    }
  }
  const visits = add.visits ?? 0;
  const visitors = add.visitors ?? 0;
  const hits = add.hits ?? 0;
  await tx
    .insert(visitStats)
    .values({ day, dimension, key: finalKey, visits, visitors, hits })
    .onConflictDoUpdate({
      target: [visitStats.day, visitStats.dimension, visitStats.key],
      set: {
        visits: sql`${visitStats.visits} + ${visits}`,
        visitors: sql`${visitStats.visitors} + ${visitors}`,
        hits: sql`${visitStats.hits} + ${hits}`,
      },
    });
}

export type PageviewInput = {
  now: Date;
  /** IP já normalizado (usado só para calcular o código do visitante; não é gravado). */
  ip: string;
  userAgent: string;
  /** Página do relatório (ver `resolvePageKey`). */
  page: string;
  origin: VisitOrigin;
  device: VisitDevice;
};

export type PageviewResult = { newVisit: boolean; newVisitor: boolean };

/** Registra uma página vista: continua a visita em andamento ou abre uma nova. */
export async function recordPageview(input: PageviewInput): Promise<PageviewResult> {
  const now = input.now.getTime();
  const day = todayISO(input.now);
  let rolledOver = false;
  const result = await db.transaction(async (tx) => {
    const { salt, created } = await dailySalt(day, tx);
    rolledOver = created;
    const hash = visitorHash(salt, input.ip, input.userAgent);
    const [last] = await tx
      .select({ id: visitSessions.id, lastSeenAt: visitSessions.lastSeenAt })
      .from(visitSessions)
      .where(and(eq(visitSessions.day, day), eq(visitSessions.visitorHash, hash)))
      .orderBy(desc(visitSessions.lastSeenAt))
      .limit(1);

    const idle = last ? now - last.lastSeenAt.getTime() : Infinity;
    if (last && idle <= SESSION_IDLE_MS) {
      // mesma visita: mais uma página
      await tx
        .update(visitSessions)
        .set({ lastSeenAt: new Date(Math.max(now, last.lastSeenAt.getTime())), pageviews: sql`${visitSessions.pageviews} + 1` })
        .where(eq(visitSessions.id, last.id));
      await bump(tx, day, "total", "", { hits: 1 });
      await bump(tx, day, "pagina", input.page, { hits: 1 });
      return { newVisit: false, newVisitor: false };
    }

    // visita nova (primeira do dia para este visitante, ou a anterior ficou mais de 30 min parada)
    const newVisitor = !last;
    const { source, referrerHost, campaign } = input.origin;
    await tx.insert(visitSessions).values({
      day,
      visitorHash: hash,
      startedAt: input.now,
      lastSeenAt: input.now,
      pageviews: 1,
      entryPath: input.page,
      source,
      referrerHost,
      campaign,
      device: input.device,
    });
    await bump(tx, day, "total", "", { visits: 1, visitors: newVisitor ? 1 : 0, hits: 1 });
    await bump(tx, day, "origem", source, { visits: 1 });
    if (referrerHost) await bump(tx, day, "referencia", referrerHost, { visits: 1 });
    if (campaign) await bump(tx, day, "campanha", campaign, { visits: 1 });
    await bump(tx, day, "dispositivo", input.device, { visits: 1 });
    await bump(tx, day, "pagina", input.page, { visits: 1, hits: 1 });
    return { newVisit: true, newVisitor };
  });
  // primeiro acesso do dia: boa hora para apagar as sessões que passaram do prazo (fora da transação)
  if (rolledOver) await pruneVisitSessions(input.now).catch(() => undefined);
  return result;
}

/** Registra um clique medido (WhatsApp, banner). Também mantém viva a visita em andamento de quem clicou. */
export async function recordTrackEvent(input: { now: Date; ip: string; userAgent: string; event: TrackEvent }): Promise<void> {
  const now = input.now.getTime();
  const day = todayISO(input.now);
  await db.transaction(async (tx) => {
    const { salt } = await dailySalt(day, tx);
    const hash = visitorHash(salt, input.ip, input.userAgent);
    await tx
      .update(visitSessions)
      .set({ lastSeenAt: input.now })
      .where(and(eq(visitSessions.day, day), eq(visitSessions.visitorHash, hash), gte(visitSessions.lastSeenAt, new Date(now - SESSION_IDLE_MS))));
    await bump(tx, day, "clique", input.event.key, { hits: 1 });
  });
}

/**
 * Conta um formulário enviado (chamado onde o lead é gravado). A chave é a página em que o formulário estava.
 * Nunca lança: uma falha aqui não pode custar um pedido de contato.
 */
export async function recordFormSubmission(originPath: string | null | undefined, now: Date = new Date()): Promise<void> {
  try {
    const page = (await resolvePageKey(originPath)) ?? NOT_FOUND_PAGE_KEY;
    await bump(db, todayISO(now), "formulario", page === NOT_FOUND_PAGE_KEY ? "(página não informada)" : page, { hits: 1 });
  } catch (error) {
    console.error("[métricas] não foi possível contar o envio do formulário:", (error as Error)?.message ?? "erro desconhecido");
  }
}
