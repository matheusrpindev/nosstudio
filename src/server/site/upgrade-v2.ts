/**
 * Atualização do conteúdo do site para o briefing v2, para bancos JÁ CRIADOS com o seed anterior.
 *
 * Idempotente e conservadora: só toca registros que ainda estão EXATAMENTE como o seed antigo os criou (mesmo
 * nome e mesmos textos). O que os sócios editaram no painel não é sobrescrito, e rodar de novo não muda nada —
 * depois da primeira execução nenhum registro "original" sobra para casar.
 *
 * - Serviços: os cinco do seed antigo viram os correspondentes do v2 (título, itens, endereço, ordem); os quatro
 *   que faltam para as nove áreas do briefing são criados SE algum original foi atualizado nesta execução (isto é,
 *   se o banco ainda estava no seed antigo) e o endereço estiver livre.
 * - Planos: Começo → Plano Essencial, Presença → Plano Integrado (destaque; apoia-se no Essencial), Destaque →
 *   Plano Estratégico, com as entregas do briefing. Avulsos: acrescenta "Design" e "Campanhas pontuais" nas mesmas
 *   condições dos serviços novos.
 * - FAQ (rascunho) que citava os nomes antigos dos planos e o link do aviso de casamentos.
 * - Aviso de abertura da barra do topo: vira o texto inicial do briefing v2 ("Agenda aberta para novos projetos.
 *   Vamos criar juntos?") — só se ainda estiver idêntico ao do seed antigo (texto, link, cores, sem período e sem
 *   páginas escolhidas). Ligado continua ligado; desligado continua desligado.
 *
 * Roda no `npm run db:seed` (logo, em todo `db:setup` / start de produção) e é testado em upgrade-v2.db.test.ts.
 */
import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements, faqs, packages, services } from "@/db/schema";
import { SITE_PATHS } from "@/lib/site/paths";
import {
  ANNOUNCEMENT_OPENING_V1,
  ANNOUNCEMENT_OPENING_V2,
  FAQ_PLANS_V1,
  FAQ_PLANS_V2,
  OLD_WEDDINGS_PATH,
  PLANS_V1,
  PLANS_V2,
  SERVICES_V1,
  SERVICES_V2,
  STANDALONE_ADDED_V2,
  STANDALONE_V1,
} from "./seed-data";

export type UpgradeReport = {
  servicesUpdated: number;
  servicesCreated: number;
  plansUpdated: number;
  standaloneCreated: number;
  faqsUpdated: number;
  announcementsUpdated: number;
  openingAnnouncementUpdated: number;
};

const sameList = (a: readonly string[] | null | undefined, b: readonly string[]) => Array.isArray(a) && a.length === b.length && a.every((item, i) => item === b[i]);

export async function upgradeSiteContentToV2(): Promise<UpgradeReport> {
  const report: UpgradeReport = { servicesUpdated: 0, servicesCreated: 0, plansUpdated: 0, standaloneCreated: 0, faqsUpdated: 0, announcementsUpdated: 0, openingAnnouncementUpdated: 0 };

  await db.transaction(async (tx) => {
    // ------------------------------------------------------------ serviços
    const serviceRows = await tx.select().from(services);
    const slugs = new Set(serviceRows.map((row) => row.slug));
    for (const old of SERVICES_V1) {
      const row = serviceRows.find(
        (candidate) =>
          candidate.slug === old.slug &&
          candidate.title === old.title &&
          candidate.summary === old.summary &&
          candidate.description === "" &&
          candidate.ctaLabel === old.ctaLabel &&
          sameList(candidate.items, old.items),
      );
      if (!row) continue;
      const next = SERVICES_V2.find((service) => service.slug === old.becomes);
      if (!next) continue;
      // o endereço novo só entra se estiver livre (ou se for o do próprio registro)
      const slug = next.slug === row.slug || !slugs.has(next.slug) ? next.slug : row.slug;
      await tx
        .update(services)
        .set({
          slug,
          title: next.title,
          summary: next.summary,
          items: next.items,
          ctaLabel: next.ctaLabel,
          interest: next.interest,
          pagePath: next.pagePath ?? null,
          sortOrder: SERVICES_V2.indexOf(next) + 1,
        })
        .where(eq(services.id, row.id));
      slugs.delete(row.slug);
      slugs.add(slug);
      report.servicesUpdated++;
    }
    if (report.servicesUpdated > 0) {
      for (const [index, service] of SERVICES_V2.entries()) {
        if (slugs.has(service.slug) || SERVICES_V1.some((old) => old.becomes === service.slug)) continue;
        await tx.insert(services).values({ ...service, pagePath: service.pagePath ?? null, sortOrder: index + 1 });
        slugs.add(service.slug);
        report.servicesCreated++;
      }
    }

    // -------------------------------------------------------------- planos
    const packageRows = await tx.select().from(packages);
    const planIds = new Map<string, number>();
    for (const [index, old] of PLANS_V1.entries()) {
      const next = PLANS_V2[index];
      const row = packageRows.find(
        (candidate) =>
          candidate.kind === "plano" &&
          candidate.name === old.name &&
          candidate.tagline === old.tagline &&
          candidate.description === old.description &&
          candidate.includes.length === 0 &&
          candidate.deliverables.length === 0 &&
          candidate.priceCents == null,
      );
      if (!row) continue;
      await tx
        .update(packages)
        .set({ name: next.name, tagline: next.tagline, description: next.description, includes: next.includes, recommended: Boolean(next.recommended) })
        .where(eq(packages.id, row.id));
      planIds.set(next.name, row.id);
      report.plansUpdated++;
    }
    // "tudo do plano X, mais…": só entre planos que esta execução acabou de atualizar
    for (const plan of PLANS_V2) {
      const id = planIds.get(plan.name);
      const baseId = plan.base ? planIds.get(plan.base) : undefined;
      if (id && baseId) await tx.update(packages).set({ basePackageId: baseId }).where(eq(packages.id, id));
    }
    if (report.plansUpdated > 0) {
      const names = new Set(packageRows.map((row) => row.name));
      const lastOrder = Math.max(0, ...packageRows.filter((row) => row.kind === "avulso").map((row) => row.sortOrder));
      const hasOriginalStandalone = packageRows.some((row) => row.kind === "avulso" && STANDALONE_V1.includes(row.name));
      if (hasOriginalStandalone) {
        for (const [offset, name] of STANDALONE_ADDED_V2.entries()) {
          if (names.has(name)) continue;
          await tx.insert(packages).values({ kind: "avulso", name, sortOrder: lastOrder + offset + 1 });
          report.standaloneCreated++;
        }
      }
    }

    // ----------------------------------------------------------------- FAQ
    const updatedFaqs = await tx
      .update(faqs)
      .set({ question: FAQ_PLANS_V2.question, answer: FAQ_PLANS_V2.answer })
      .where(and(eq(faqs.question, FAQ_PLANS_V1.question), eq(faqs.answer, FAQ_PLANS_V1.answer)))
      .returning({ id: faqs.id });
    report.faqsUpdated = updatedFaqs.length;

    // -------------------------------------------------------------- avisos
    const updatedAnnouncements = await tx
      .update(announcements)
      .set({ linkUrl: SITE_PATHS.events })
      .where(sql`${announcements.linkUrl} = ${OLD_WEDDINGS_PATH}`)
      .returning({ id: announcements.id });
    report.announcementsUpdated = updatedAnnouncements.length;

    // texto inicial do briefing v2 no aviso de abertura — só se ninguém mexeu nele
    const updatedOpening = await tx
      .update(announcements)
      .set({ message: ANNOUNCEMENT_OPENING_V2.message, linkLabel: ANNOUNCEMENT_OPENING_V2.linkLabel, linkUrl: ANNOUNCEMENT_OPENING_V2.linkUrl })
      .where(
        and(
          eq(announcements.message, ANNOUNCEMENT_OPENING_V1.message),
          eq(announcements.linkLabel, ANNOUNCEMENT_OPENING_V1.linkLabel),
          eq(announcements.linkUrl, ANNOUNCEMENT_OPENING_V1.linkUrl),
          eq(announcements.bgColor, ANNOUNCEMENT_OPENING_V1.bgColor),
          eq(announcements.textColor, ANNOUNCEMENT_OPENING_V1.textColor),
          isNull(announcements.startsAt),
          isNull(announcements.endsAt),
          sql`json_array_length(${announcements.pages}) = 0`,
        ),
      )
      .returning({ id: announcements.id });
    report.openingAnnouncementUpdated = updatedOpening.length;
  });

  return report;
}
