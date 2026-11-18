import { describe, expect, it } from "vitest";
import { defaultSiteContent, SITE_CONTENT_KEYS, type SiteContentKey } from "@/lib/site/content";
import { normalizeHref, normalizeInstagram, parseSectionForm } from "./build";
import { SITE_SECTIONS } from "./config";

/** Monta o FormData como o navegador enviaria para os valores atuais da seção. */
function encode(key: SiteContentKey, content: unknown): FormData {
  const form = new FormData();
  const pick = (path: string): unknown => path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], content);
  for (const group of SITE_SECTIONS[key].groups) {
    for (const field of group.fields) {
      const value = pick(field.path);
      switch (field.type) {
        case "switch":
          if (value) form.set(field.path, "on");
          break;
        case "link": {
          const l = value as { label: string; href: string };
          form.set(`${field.path}.label`, l.label);
          form.set(`${field.path}.href`, l.href);
          break;
        }
        case "seoPage": {
          const p = value as { title: string; description: string };
          form.set(`${field.path}.title`, p.title);
          form.set(`${field.path}.description`, p.description);
          break;
        }
        case "image":
          form.set(field.path, value == null ? "" : String(value));
          break;
        case "list":
          form.set(field.path, JSON.stringify(value));
          break;
        default:
          form.set(field.path, String(value ?? ""));
      }
    }
  }
  return form;
}

describe("formulário → seção", () => {
  for (const key of SITE_CONTENT_KEYS) {
    it(`${key}: enviar o formulário sem mexer em nada devolve exatamente os padrões`, () => {
      const result = parseSectionForm(key, encode(key, defaultSiteContent[key]));
      expect(result.ok, JSON.stringify(result.ok ? "" : result.errors)).toBe(true);
      if (result.ok) expect(result.data).toEqual(defaultSiteContent[key]);
    });
  }

  it("aplica a edição do título do hero e mantém o resto", () => {
    const form = encode("home", defaultSiteContent.home);
    form.set("hero.title", "  Novo título  ");
    const result = parseSectionForm("home", form);
    expect(result.ok && (result.data.hero as { title: string }).title).toBe("Novo título");
  });

  it("lê os switches de visibilidade (ausente = desligado)", () => {
    const form = encode("visibility", defaultSiteContent.visibility);
    form.set("portfolio", "on");
    form.delete("faq");
    const result = parseSectionForm("visibility", form);
    expect(result.ok && result.data).toMatchObject({ portfolio: true, faq: false, packages: true });
  });

  it("devolve erros por campo, em português", () => {
    const form = encode("home", defaultSiteContent.home);
    form.set("hero.title", "x".repeat(121));
    form.set("hero.primaryCta.href", "javascript:alert(1)");
    const result = parseSectionForm("home", form);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["hero.title"]).toBe("Máximo de 120 caracteres.");
      expect(result.errors["hero.primaryCta.href"]).toMatch(/Link inválido/);
      expect(result.values["hero.title"]).toHaveLength(121);
    }
  });

  it("exige os campos marcados como obrigatórios", () => {
    const form = encode("general", defaultSiteContent.general);
    form.set("brandName", "   ");
    const result = parseSectionForm("general", form);
    expect(!result.ok && result.errors.brandName).toBe("Preencha este campo.");
  });

  it("valida e-mail e WhatsApp", () => {
    const form = encode("general", defaultSiteContent.general);
    form.set("email", "sem-arroba");
    form.set("whatsapp", "123");
    const result = parseSectionForm("general", form);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["email", "whatsapp"]);

    form.set("email", "Contato@NosStudio.com.br");
    form.set("whatsapp", "(41) 99999-0000");
    const ok = parseSectionForm("general", form);
    expect(ok.ok && ok.data).toMatchObject({ email: "contato@nosstudio.com.br", whatsapp: "(41) 99999-0000" });
  });

  it("limpa itens de lista em branco, valida links dos itens e aponta o item com erro", () => {
    const form = encode("general", defaultSiteContent.general);
    form.set("socialLinks", JSON.stringify([{ label: "TikTok", href: "tiktok.com/@nos" }, { label: "", href: "" }, { label: "Vídeos", href: "javascript:x" }]));
    const result = parseSectionForm("general", form);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.socialLinks).toMatch(/^Rede 2: /);

    form.set("socialLinks", JSON.stringify([{ label: "TikTok", href: "tiktok.com/@nos" }, { label: "", href: "" }]));
    const ok = parseSectionForm("general", form);
    expect(ok.ok && ok.data.socialLinks).toEqual([{ label: "TikTok", href: "https://tiktok.com/@nos" }]);
  });

  it("coleta os ids das imagens (campos e itens de lista) e rejeita id inválido", () => {
    const form = encode("about", defaultSiteContent.about);
    form.set("coupleMediaId", "7");
    form.set("founders", JSON.stringify([{ ...defaultSiteContent.about.founders[0], mediaId: 9 }]));
    const result = parseSectionForm("about", form);
    expect(result.ok && result.mediaIds.sort()).toEqual([7, 9]);

    form.set("coupleMediaId", "abc");
    const bad = parseSectionForm("about", form);
    expect(!bad.ok && bad.errors.coupleMediaId).toMatch(/Imagem inválida/);
  });

  it("limite de itens da lista", () => {
    const form = encode("home", defaultSiteContent.home);
    const item = { title: "a", text: "b", href: "/" };
    form.set("highlights.items", JSON.stringify(Array.from({ length: 7 }, () => item)));
    const result = parseSectionForm("home", form);
    expect(!result.ok && result.errors["highlights.items"]).toBe("Máximo de 6 itens.");
  });

  it("lista corrompida não derruba nada", () => {
    const form = encode("howItWorks", defaultSiteContent.howItWorks);
    form.set("steps", "{não é json");
    const result = parseSectionForm("howItWorks", form);
    expect(!result.ok && result.errors.steps).toMatch(/Recarregue/);
  });
});

describe("botões (texto + link)", () => {
  type Cta = { label: string; href: string };
  const heroCta = (form: FormData) => {
    const result = parseSectionForm("home", form);
    return result.ok ? ((result.data.hero as { primaryCta: Cta }).primaryCta as Cta) : result.errors;
  };

  it("texto vazio esconde o botão: salva sem erro e guarda o link (como promete a dica do campo)", () => {
    const form = encode("home", defaultSiteContent.home);
    form.set("hero.primaryCta.label", "   ");
    expect(heroCta(form)).toEqual({ label: "", href: "/servicos" });
  });

  it("texto vazio com link inválido também salva: o link inválido é descartado, sem mensagem de erro", () => {
    const form = encode("home", defaultSiteContent.home);
    form.set("hero.primaryCta.label", "");
    form.set("hero.primaryCta.href", "javascript:alert(1)");
    expect(heroCta(form)).toEqual({ label: "", href: "" });
  });

  it("com texto, o link continua sendo validado", () => {
    const form = encode("home", defaultSiteContent.home);
    form.set("hero.primaryCta.href", "contato");
    const result = parseSectionForm("home", form);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors["hero.primaryCta.href"]).toMatch(/Link inválido/);
  });
});

describe("links e Instagram", () => {
  it("aceita caminhos do site, âncoras e endereços externos; recusa o resto", () => {
    expect(normalizeHref("")).toBe("");
    expect(normalizeHref(" /contato ")).toBe("/contato");
    expect(normalizeHref("/servicos#video")).toBe("/servicos#video");
    expect(normalizeHref("#faq")).toBe("#faq");
    expect(normalizeHref("https://exemplo.com.br/a")).toBe("https://exemplo.com.br/a");
    expect(normalizeHref("exemplo.com.br")).toBe("https://exemplo.com.br/");
    expect(normalizeHref("contato")).toBeNull();
    expect(normalizeHref("//evil.com")).toBeNull();
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,x")).toBeNull();
    expect(normalizeHref("/com espaço")).toBeNull();
  });

  it("normaliza o @ do Instagram", () => {
    expect(normalizeInstagram("nosstudio.cria")).toBe("@nosstudio.cria");
    expect(normalizeInstagram("@nosstudio.cria")).toBe("@nosstudio.cria");
    expect(normalizeInstagram("https://www.instagram.com/nosstudio.cria/")).toBe("@nosstudio.cria");
    expect(normalizeInstagram("")).toBe("");
    expect(normalizeInstagram("dois nomes")).toBeNull();
  });
});
