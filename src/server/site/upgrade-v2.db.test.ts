import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { announcements, faqs, packages, services } from "@/db/schema";
import { FAQ_PLANS_V1, FAQ_PLANS_V2, PLANS_V1, PLANS_V2, SERVICES_V1, SERVICES_V2, STANDALONE_ADDED_V2, STANDALONE_V1 } from "./seed-data";
import { upgradeSiteContentToV2 } from "./upgrade-v2";

/**
 * A atualização para o briefing v2 em bancos criados com o seed anterior: só toca o que ninguém editou e pode
 * rodar quantas vezes for. O teste monta o estado do seed v1 (com um serviço e um plano editados "pelos sócios"),
 * roda a atualização duas vezes e confere o resultado.
 */
const backup: { services: (typeof services.$inferSelect)[]; packages: (typeof packages.$inferSelect)[] } = { services: [], packages: [] };
const extraFaqs: number[] = [];
const extraAnnouncements: number[] = [];

beforeAll(async () => {
  // guarda o que houver nas tabelas (o banco de teste é compartilhado entre os arquivos) e parte do seed v1
  backup.services = await db.select().from(services);
  backup.packages = await db.select().from(packages);
  await db.delete(services);
  await db.delete(packages);

  await db.insert(services).values(
    SERVICES_V1.map((service, index) => ({
      slug: service.slug,
      title: service.title,
      summary: service.summary,
      items: service.items,
      ctaLabel: service.ctaLabel,
      interest: "outro" as const,
      pagePath: service.slug === "casamentos" ? "/casamentos" : null,
      sortOrder: index + 1,
    })),
  );
  // os sócios editaram o serviço de marketing (mudaram o resumo): não pode ser sobrescrito
  await db.update(services).set({ summary: "[Teste] Resumo escrito pelos sócios." }).where(eq(services.slug, "marketing"));

  await db.insert(packages).values([
    ...PLANS_V1.map((plan, index) => ({ kind: "plano" as const, ...plan, recommended: index === 1, sortOrder: index + 1 })),
    ...STANDALONE_V1.map((name, index) => ({ kind: "avulso" as const, name, sortOrder: 10 + index })),
  ]);
  // os sócios já cadastraram um valor no plano "Destaque": não pode ser renomeado nem ganhar entregas
  await db.update(packages).set({ priceMode: "a_partir", priceCents: 250000 }).where(eq(packages.name, "Destaque"));

  const [faq] = await db.insert(faqs).values({ question: FAQ_PLANS_V1.question, answer: FAQ_PLANS_V1.answer }).returning({ id: faqs.id });
  const [editedFaq] = await db.insert(faqs).values({ question: FAQ_PLANS_V1.question, answer: "[Teste] Resposta editada." }).returning({ id: faqs.id });
  extraFaqs.push(faq.id, editedFaq.id);
  const [notice] = await db.insert(announcements).values({ message: "[Teste] aviso de casamentos", linkUrl: "/casamentos" }).returning({ id: announcements.id });
  extraAnnouncements.push(notice.id);
});

afterAll(async () => {
  await db.delete(services);
  await db.delete(packages);
  if (backup.services.length) await db.insert(services).values(backup.services);
  if (backup.packages.length) await db.insert(packages).values(backup.packages);
  if (extraFaqs.length) await db.delete(faqs).where(inArray(faqs.id, extraFaqs));
  if (extraAnnouncements.length) await db.delete(announcements).where(inArray(announcements.id, extraAnnouncements));
});

describe("atualização idempotente do site para o briefing v2", () => {
  it("primeira execução: atualiza só os registros originais do seed e cria o que falta", async () => {
    const report = await upgradeSiteContentToV2();
    expect(report).toEqual({ servicesUpdated: 4, servicesCreated: 4, plansUpdated: 2, standaloneCreated: 2, faqsUpdated: 1, announcementsUpdated: 1 });

    const serviceRows = await db.select().from(services);
    const bySlug = new Map(serviceRows.map((row) => [row.slug, row]));
    // os quatro originais viraram os do v2 (título, itens, endereço, ordem, interesse)
    for (const slug of ["fotografia", "audiovisual", "eventos-e-storymaker", "casamentos"]) {
      const expected = SERVICES_V2.find((service) => service.slug === slug);
      const row = bySlug.get(slug);
      expect(row, slug).toBeDefined();
      expect(row?.title).toBe(expected?.title);
      expect(row?.items).toEqual(expected?.items);
      expect(row?.interest).toBe(expected?.interest);
      expect(row?.sortOrder).toBe(SERVICES_V2.findIndex((service) => service.slug === slug) + 1);
    }
    expect(bySlug.get("casamentos")?.pagePath).toBe("/eventos-e-casamentos");
    expect(bySlug.has("video")).toBe(false);
    expect(bySlug.has("eventos")).toBe(false);
    // o serviço EDITADO pelos sócios ficou como estava (mesmo endereço, mesmo resumo, mesmos itens)
    const edited = bySlug.get("marketing");
    expect(edited?.title).toBe("Marketing e redes sociais");
    expect(edited?.summary).toBe("[Teste] Resumo escrito pelos sócios.");
    expect(edited?.items).toEqual(SERVICES_V1.find((service) => service.slug === "marketing")?.items);
    // os quatro que faltavam foram criados; "marketing-e-estrategia" NÃO (era a vaga do que os sócios editaram)
    for (const slug of ["redes-sociais", "design-grafico", "identidade-visual", "trafego-pago"]) expect(bySlug.has(slug), slug).toBe(true);
    expect(bySlug.has("marketing-e-estrategia")).toBe(false);
    // nada inventado: os serviços novos nascem sem resumo, descrição, benefícios e perguntas
    const created = bySlug.get("trafego-pago");
    expect([created?.summary, created?.description]).toEqual(["", ""]);
    expect(created?.benefits).toEqual([]);
    expect(created?.faq).toEqual([]);

    const packageRows = await db.select().from(packages);
    const byName = new Map(packageRows.map((row) => [row.name, row]));
    expect(byName.get("Plano Essencial")?.includes).toEqual(PLANS_V2[0].includes);
    const integrado = byName.get("Plano Integrado");
    expect(integrado?.includes).toEqual(PLANS_V2[1].includes);
    expect(integrado?.recommended).toBe(true);
    expect(integrado?.basePackageId).toBe(byName.get("Plano Essencial")?.id);
    // sem preço publicado em nenhum plano atualizado
    expect([byName.get("Plano Essencial")?.priceMode, integrado?.priceMode]).toEqual(["sob_consulta", "sob_consulta"]);
    expect(integrado?.priceCents).toBeNull();
    // o plano que já tinha valor cadastrado pelos sócios não foi tocado
    const kept = byName.get("Destaque");
    expect(kept?.priceCents).toBe(250000);
    expect(kept?.includes).toEqual([]);
    expect(byName.has("Plano Estratégico")).toBe(false);
    for (const name of STANDALONE_ADDED_V2) expect(byName.get(name)?.kind).toBe("avulso");

    const faqRows = await db.select().from(faqs).where(inArray(faqs.id, extraFaqs));
    expect(faqRows.find((row) => row.id === extraFaqs[0])).toMatchObject(FAQ_PLANS_V2);
    expect(faqRows.find((row) => row.id === extraFaqs[1])).toMatchObject({ question: FAQ_PLANS_V1.question, answer: "[Teste] Resposta editada." });
    const [notice] = await db.select().from(announcements).where(eq(announcements.id, extraAnnouncements[0]));
    expect(notice.linkUrl).toBe("/eventos-e-casamentos");
  });

  it("segunda execução: não muda nada (nem recria o que os sócios apagarem depois)", async () => {
    await db.delete(services).where(eq(services.slug, "trafego-pago"));
    await db.delete(packages).where(eq(packages.name, "Design"));
    const before = { services: await db.select().from(services), packages: await db.select().from(packages) };

    const report = await upgradeSiteContentToV2();
    expect(Object.values(report).every((count) => count === 0)).toBe(true);
    expect(await db.select().from(services)).toEqual(before.services);
    expect(await db.select().from(packages)).toEqual(before.packages);
  });

  it("banco novo (já no v2) ou vazio: nada a fazer", async () => {
    await db.delete(services);
    await db.delete(packages);
    expect(Object.values(await upgradeSiteContentToV2()).every((count) => count === 0)).toBe(true);
    await db.insert(services).values(SERVICES_V2.map((service, index) => ({ ...service, pagePath: service.pagePath ?? null, sortOrder: index + 1 })));
    await db.insert(packages).values(PLANS_V2.map((plan, index) => ({ kind: "plano" as const, name: plan.name, tagline: plan.tagline, description: plan.description, includes: plan.includes, sortOrder: index + 1 })));
    expect(Object.values(await upgradeSiteContentToV2()).every((count) => count === 0)).toBe(true);
    expect(await db.select({ slug: services.slug }).from(services)).toHaveLength(SERVICES_V2.length);
  });
});
