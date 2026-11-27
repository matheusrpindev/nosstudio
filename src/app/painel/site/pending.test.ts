import { describe, expect, it } from "vitest";
import { computeLaunchPending, type LaunchSnapshot } from "./pending";

const READY: LaunchSnapshot = {
  whatsapp: "(41) 99999-0000",
  email: "contato@nos.com.br",
  founders: [
    { name: "Pedro Henrique", mediaId: 1 },
    { name: "Laura Nepomuceno", mediaId: 2 },
  ],
  coupleMediaId: 3,
  publishedFaqs: 4,
  privacyIsBaseText: false,
  termsIsBaseText: false,
  cookiesIsBaseText: false,
  biosUnreviewed: false,
  visiblePlans: 3,
  plansWithIncludes: 3,
  visibleServices: 9,
  servicesWithoutDescription: 0,
  packagesWithPrice: 2,
  visiblePackages: 3,
};

const ids = (s: LaunchSnapshot) => computeLaunchPending(s).map((p) => p.id);

describe("pendências de lançamento", () => {
  it("sem pendências quando tudo está pronto", () => {
    expect(ids(READY)).toEqual([]);
  });

  it("política própria que não fala da contagem de visitas vira pendência", () => {
    const pending = computeLaunchPending({ ...READY, privacyMissesVisitMeasurement: true });
    expect(pending.map((item) => item.id)).toEqual(["privacy-visits"]);
    expect(pending[0]).toMatchObject({ tone: "alerta", href: "/painel/site/textos/privacyPage" });
  });

  it("lista tudo o que falta num site recém-criado, cada item com link para resolver", () => {
    const empty: LaunchSnapshot = {
      whatsapp: "",
      email: "",
      founders: [
        { name: "Pedro Henrique", mediaId: null },
        { name: "Laura Nepomuceno", mediaId: null },
      ],
      coupleMediaId: null,
      publishedFaqs: 0,
      privacyIsBaseText: true,
      termsIsBaseText: true,
      cookiesIsBaseText: true,
      biosUnreviewed: true,
      visiblePlans: 3,
      plansWithIncludes: 3,
      visibleServices: 9,
      servicesWithoutDescription: 9,
      packagesWithPrice: 0,
      visiblePackages: 3,
    };
    const list = computeLaunchPending(empty);
    expect(list.map((p) => p.id)).toEqual([
      "whatsapp",
      "email",
      "founders-photos",
      "couple-photo",
      "bios",
      "faq",
      "privacy",
      "terms",
      "cookies",
      "services-descriptions",
      "packages-prices",
    ]);
    // o que depende de decisão dos sócios (e não impede o lançamento) é só lembrete
    expect(list.filter((p) => p.tone === "info").map((p) => p.id)).toEqual(["services-descriptions", "packages-prices"]);
    for (const item of list) expect(item.href).toMatch(/^\/painel\/site\//);
    expect(list.find((p) => p.id === "packages-prices")?.tone).toBe("info");
    expect(list.find((p) => p.id === "founders-photos")?.description).toContain("Pedro, Laura");
  });

  it("espaços em branco não contam como WhatsApp/e-mail", () => {
    expect(ids({ ...READY, whatsapp: "   ", email: " " })).toEqual(["whatsapp", "email"]);
  });

  it("falta a foto de só um fundador", () => {
    const list = computeLaunchPending({ ...READY, founders: [{ name: "Pedro Henrique", mediaId: 1 }, { name: "Laura Nepomuceno", mediaId: null }] });
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Falta a foto de um fundador");
    expect(list[0].description).toContain("Laura");
  });

  it("briefing v2: biografias a validar e termos/cookies a revisar saem da lista quando resolvidos", () => {
    expect(ids({ ...READY, biosUnreviewed: true })).toEqual(["bios"]);
    expect(ids({ ...READY, termsIsBaseText: true })).toEqual(["terms"]);
    expect(ids({ ...READY, cookiesIsBaseText: true })).toEqual(["cookies"]);
    const bios = computeLaunchPending({ ...READY, biosUnreviewed: true })[0];
    expect(bios.href).toBe("/painel/site/textos/about#bloco-fundadores");
  });

  it("planos sem entregas e serviços sem descrição são lembretes", () => {
    expect(ids({ ...READY, plansWithIncludes: 2 })).toEqual(["plans-includes"]);
    expect(ids({ ...READY, visiblePlans: 0, plansWithIncludes: 0 })).toEqual([]);
    const one = computeLaunchPending({ ...READY, servicesWithoutDescription: 1 })[0];
    expect(one.title).toBe("Um serviço ainda sem descrição");
    expect(one.tone).toBe("info");
  });

  it("pacotes: só lembra dos valores se houver pacote visível e nenhum com valor", () => {
    expect(ids({ ...READY, packagesWithPrice: 0, visiblePackages: 0 })).toEqual([]);
    expect(ids({ ...READY, packagesWithPrice: 0, visiblePackages: 2 })).toEqual(["packages-prices"]);
  });
});
