import "server-only";
import { and, count, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { announcements, faqs, packages, portfolioProjects, services, testimonials } from "@/db/schema";
import { nowLocal } from "@/lib/dates";
import { defaultSiteContent, type SiteContent } from "@/lib/site/content";
import { getSiteContentForEdit } from "@/server/site/content";
import { computeLaunchPending, type LaunchPending } from "./pending";
import { getSectionInfos } from "./textos/store";
import { SECTION_ORDER } from "./textos/config";

export type SiteOverview = {
  visibility: SiteContent["visibility"];
  counts: {
    announcementsActive: number;
    announcementsTotal: number;
    servicesVisible: number;
    servicesTotal: number;
    packagesVisible: number;
    packagesTotal: number;
    packagesWithPrice: number;
    faqsPublished: number;
    faqsTotal: number;
    portfolioPublished: number;
    portfolioTotal: number;
    testimonialsPublished: number;
    testimonialsTotal: number;
  };
  sectionsEdited: number;
  sectionsTotal: number;
  pending: LaunchPending[];
};

const n = (rows: { n: number }[]) => rows[0]?.n ?? 0;

/** Contadores de cada área do editor + pendências de lançamento. Leitura direta do banco (sem cache). */
export async function getSiteOverview(): Promise<SiteOverview> {
  const now = nowLocal();
  const [general, visibility, about, privacy, terms, cookies, infos] = await Promise.all([
    getSiteContentForEdit("general"),
    getSiteContentForEdit("visibility"),
    getSiteContentForEdit("about"),
    getSiteContentForEdit("privacyPage"),
    getSiteContentForEdit("termsPage"),
    getSiteContentForEdit("cookiesPage"),
    getSectionInfos(SECTION_ORDER),
  ]);
  const [serviceRows, planRows] = await Promise.all([
    db.select({ description: services.description }).from(services).where(eq(services.visible, true)),
    db.select({ includes: packages.includes }).from(packages).where(and(eq(packages.visible, true), eq(packages.kind, "plano"))),
  ]);

  const [annActive, annTotal, svcVisible, svcTotal, pkgVisible, pkgTotal, pkgPrice, faqPub, faqTotal, portPub, portTotal, testPub, testTotal] = await Promise.all([
    db.select({ n: count() }).from(announcements).where(and(eq(announcements.enabled, true), or(isNull(announcements.endsAt), gt(announcements.endsAt, now)))),
    db.select({ n: count() }).from(announcements),
    db.select({ n: count() }).from(services).where(eq(services.visible, true)),
    db.select({ n: count() }).from(services),
    db.select({ n: count() }).from(packages).where(eq(packages.visible, true)),
    db.select({ n: count() }).from(packages),
    db.select({ n: count() }).from(packages).where(and(eq(packages.visible, true), ne(packages.priceMode, "sob_consulta"), sql`${packages.priceCents} is not null`)),
    db.select({ n: count() }).from(faqs).where(and(eq(faqs.published, true), sql`trim(${faqs.answer}) <> ''`)),
    db.select({ n: count() }).from(faqs),
    db.select({ n: count() }).from(portfolioProjects).where(eq(portfolioProjects.published, true)),
    db.select({ n: count() }).from(portfolioProjects),
    db.select({ n: count() }).from(testimonials).where(and(eq(testimonials.published, true), eq(testimonials.authorized, true))),
    db.select({ n: count() }).from(testimonials),
  ]);

  const counts: SiteOverview["counts"] = {
    announcementsActive: n(annActive),
    announcementsTotal: n(annTotal),
    servicesVisible: n(svcVisible),
    servicesTotal: n(svcTotal),
    packagesVisible: n(pkgVisible),
    packagesTotal: n(pkgTotal),
    packagesWithPrice: n(pkgPrice),
    faqsPublished: n(faqPub),
    faqsTotal: n(faqTotal),
    portfolioPublished: n(portPub),
    portfolioTotal: n(portTotal),
    testimonialsPublished: n(testPub),
    testimonialsTotal: n(testTotal),
  };

  const isBase = (page: { body: string; version: string }, key: "privacyPage" | "termsPage" | "cookiesPage") =>
    page.body === defaultSiteContent[key].body && page.version === defaultSiteContent[key].version;
  const privacyIsBaseText = isBase(privacy, "privacyPage");

  return {
    visibility,
    counts,
    sectionsEdited: SECTION_ORDER.filter((key) => infos[key].customized).length,
    sectionsTotal: SECTION_ORDER.length,
    pending: computeLaunchPending({
      whatsapp: general.whatsapp,
      email: general.email,
      founders: about.founders.map((founder) => ({ name: founder.name, mediaId: founder.mediaId })),
      coupleMediaId: about.coupleMediaId,
      publishedFaqs: counts.faqsPublished,
      privacyIsBaseText,
      termsIsBaseText: isBase(terms, "termsPage"),
      cookiesIsBaseText: isBase(cookies, "cookiesPage"),
      biosUnreviewed: !infos.about.customized,
      visiblePlans: planRows.length,
      plansWithIncludes: planRows.filter((row) => row.includes.length > 0).length,
      visibleServices: serviceRows.length,
      servicesWithoutDescription: serviceRows.filter((row) => !row.description.trim()).length,
      packagesWithPrice: counts.packagesWithPrice,
      visiblePackages: counts.packagesVisible,
    }),
  };
}
