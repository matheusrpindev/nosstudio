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
  packagesWithPrice: 2,
  visiblePackages: 3,
};

const ids = (s: LaunchSnapshot) => computeLaunchPending(s).map((p) => p.id);

describe("pendências de lançamento", () => {
  it("sem pendências quando tudo está pronto", () => {
    expect(ids(READY)).toEqual([]);
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
      packagesWithPrice: 0,
      visiblePackages: 3,
    };
    const list = computeLaunchPending(empty);
    expect(list.map((p) => p.id)).toEqual(["whatsapp", "email", "founders-photos", "couple-photo", "faq", "privacy", "packages-prices"]);
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

  it("pacotes: só lembra dos valores se houver pacote visível e nenhum com valor", () => {
    expect(ids({ ...READY, packagesWithPrice: 0, visiblePackages: 0 })).toEqual([]);
    expect(ids({ ...READY, packagesWithPrice: 0, visiblePackages: 2 })).toEqual(["packages-prices"]);
  });
});
