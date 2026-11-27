import { describe, expect, it } from "vitest";
import type { Media } from "@/db/schema";
import { bannerImageIssue, bannerStatus, bannerWarnings, buildBannerView, isBannerRenderable, isViewRenderable, pieceAccessibleName, resolveBannerHref, type BannerDraft, type BannerRecord, type SiteAvailability } from "./banners";

const SITE: SiteAvailability = { services: ["audiovisual", "fotografia"], plans: true, portfolio: true, projects: ["casamento-ana-bruno"], events: true };
const LAUNCH: SiteAvailability = { ...SITE, portfolio: false, projects: [] };

describe("endereço final do botão de um banner", () => {
  it("página no ar: o link fica como foi escrito (com âncora e parâmetros)", () => {
    expect(resolveBannerHref("/sobre", SITE)).toEqual({ href: "/sobre", redirectedFrom: null });
    expect(resolveBannerHref("/portfolio", SITE).href).toBe("/portfolio");
    expect(resolveBannerHref("/portfolio/casamento-ana-bruno", SITE).href).toBe("/portfolio/casamento-ana-bruno");
    expect(resolveBannerHref("/servicos/audiovisual", SITE).href).toBe("/servicos/audiovisual");
    expect(resolveBannerHref("/eventos-e-casamentos#eventos-formulario", SITE).href).toBe("/eventos-e-casamentos#eventos-formulario");
    expect(resolveBannerHref("/contato?servico=audiovisual#formulario", SITE).href).toBe("/contato?servico=audiovisual#formulario");
  });
  it("portfólio oculto (lançamento): leva a Serviços, nunca a uma página vazia", () => {
    expect(resolveBannerHref("/portfolio", LAUNCH)).toEqual({ href: "/servicos", redirectedFrom: "/portfolio" });
    expect(resolveBannerHref("/portfolio/qualquer-projeto", LAUNCH).href).toBe("/servicos");
    expect(resolveBannerHref("/portfolio?categoria=audiovisual", LAUNCH).href).toBe("/servicos");
    // sem nenhum serviço publicado, sobra o contato
    expect(resolveBannerHref("/portfolio", { ...LAUNCH, services: [] }).href).toBe("/contato");
  });
  it("projeto ou serviço que saiu do ar: volta para a lista", () => {
    expect(resolveBannerHref("/portfolio/projeto-apagado", SITE)).toEqual({ href: "/portfolio", redirectedFrom: "/portfolio/projeto-apagado" });
    expect(resolveBannerHref("/servicos/servico-apagado", SITE).href).toBe("/servicos");
    expect(resolveBannerHref("/servicos", { ...SITE, services: [] }).href).toBe("/contato");
  });
  it("planos e eventos ocultos: contato", () => {
    expect(resolveBannerHref("/planos", { ...SITE, plans: false }).href).toBe("/contato");
    expect(resolveBannerHref("/eventos-e-casamentos#eventos-formulario", { ...SITE, events: false }).href).toBe("/contato");
  });
  it("não confunde páginas de nome parecido", () => {
    expect(resolveBannerHref("/portfolio-antigo", LAUNCH).href).toBe("/portfolio-antigo");
    expect(resolveBannerHref("/planos-especiais", { ...SITE, plans: false }).href).toBe("/planos-especiais");
  });
  it("links externos passam; links perigosos ou vazios viram nada", () => {
    expect(resolveBannerHref("https://instagram.com/nosstudio.cria", LAUNCH).href).toBe("https://instagram.com/nosstudio.cria");
    for (const bad of ["javascript:alert(1)", "/\\evil.example", "data:text/html,x", "", null, undefined]) {
      expect(resolveBannerHref(bad, SITE).href, String(bad)).toBe("");
    }
    // "//host/…" é outro site (o `safeHref` o trata como link externo): nunca é confundido com uma página daqui
    expect(resolveBannerHref("//outro.example/portfolio", LAUNCH)).toEqual({ href: "https://outro.example/portfolio", redirectedFrom: null });
  });
});

const file = (id: number, over: Partial<Media> = {}): Media =>
  ({ id, storageKey: `pub/2026/11/${String(id).padStart(24, "0")}.webp`, visibility: "public", mime: "image/webp", originalName: "arte.jpg", size: 1000, width: 1920, height: 800, alt: "", variants: [], placeholderColor: "#3b1f8e", uploadedBy: null, createdAt: new Date(0) }) as Media & typeof over;
const record = (over: Partial<BannerRecord> = {}): BannerRecord => ({
  id: 7,
  layout: "tipografico",
  title: "Sua história, nosso olhar.",
  subtitle: "Marketing, comunicação e audiovisual em um só lugar",
  buttonLabel: "Conheça a NÓS",
  buttonUrl: "/sobre",
  secondaryLabel: "",
  secondaryUrl: "",
  desktopMediaId: null,
  mobileMediaId: null,
  videoMediaId: null,
  alt: "",
  bgColor: "roxo",
  tone: "claro",
  durationSeconds: 7,
  endsAt: null,
  ...over,
});

describe("montagem do banner (a mesma no site e no painel)", () => {
  const files = new Map<number, Media>([
    [1, file(1)],
    [2, file(2, {})],
    [3, { ...file(3), storageKey: "pub/2026/11/000000000000000000000003.mp4", mime: "video/mp4", width: null, height: null }],
    [4, { ...file(4), visibility: "private" }],
  ]);

  it("botões: só com rótulo E endereço válido; o destino já sai resolvido", () => {
    const view = buildBannerView(record({ buttonUrl: "/portfolio", secondaryLabel: "Sem link", secondaryUrl: "" }), files, LAUNCH);
    expect(view.primary).toEqual({ label: "Conheça a NÓS", href: "/servicos" });
    expect(view.secondary).toBeNull();
    expect(buildBannerView(record({ buttonLabel: "  ", buttonUrl: "/sobre" }), files, SITE).primary).toBeNull();
    expect(buildBannerView(record({ buttonUrl: "javascript:alert(1)" }), files, SITE).primary).toBeNull();
  });
  it("peça pronta: o link do banner vale sem rótulo e não há segundo botão", () => {
    const view = buildBannerView(record({ layout: "peca", desktopMediaId: 1, buttonLabel: "", buttonUrl: "/contato", secondaryLabel: "Outro", secondaryUrl: "/sobre" }), files, SITE);
    expect(view.primary).toEqual({ label: "", href: "/contato" });
    expect(view.secondary).toBeNull();
    expect(view.desktop?.url).toBe("/media/pub/2026/11/000000000000000000000001.webp");
  });
  it("vídeo só no banner de mídia; arquivo privado ou que não é imagem nunca vira imagem do banner", () => {
    expect(buildBannerView(record({ layout: "midia", desktopMediaId: 1, videoMediaId: 3 }), files, SITE).video).toEqual({ id: 3, url: "/media/pub/2026/11/000000000000000000000003.mp4", mime: "video/mp4" });
    expect(buildBannerView(record({ layout: "peca", desktopMediaId: 1, videoMediaId: 3 }), files, SITE).video).toBeNull();
    expect(buildBannerView(record({ layout: "midia", videoMediaId: 1 }), files, SITE).video).toBeNull(); // imagem no campo de vídeo
    const odd = buildBannerView(record({ layout: "midia", desktopMediaId: 3, mobileMediaId: 4 }), files, SITE);
    expect([odd.desktop, odd.mobile]).toEqual([null, null]);
    expect(buildBannerView(record({ layout: "midia", desktopMediaId: 99 }), files, SITE).desktop).toBeNull(); // arquivo apagado
  });
});

describe("o banner tem o mínimo para aparecer?", () => {
  it("só texto precisa de título; mídia precisa de imagem ou vídeo; peça precisa da arte", () => {
    expect(isBannerRenderable({ layout: "tipografico", title: "Olá", hasImage: false, hasVideo: false })).toBe(true);
    expect(isBannerRenderable({ layout: "tipografico", title: "  ", hasImage: true, hasVideo: true })).toBe(false);
    expect(isBannerRenderable({ layout: "midia", title: "", hasImage: false, hasVideo: true })).toBe(true);
    expect(isBannerRenderable({ layout: "midia", title: "Olá", hasImage: false, hasVideo: false })).toBe(false);
    expect(isBannerRenderable({ layout: "peca", title: "Olá", hasImage: false, hasVideo: true })).toBe(false);
    expect(isBannerRenderable({ layout: "peca", title: "", hasImage: true, hasVideo: false })).toBe(true);
    expect(isViewRenderable(buildBannerView(record({ layout: "peca", desktopMediaId: 99 }), new Map(), SITE))).toBe(false);
  });
});

describe("situação do banner", () => {
  const NOW = "2026-11-27T10:00";
  const b = (over: Partial<{ enabled: boolean; startsAt: string | null; endsAt: string | null; renderable: boolean }> = {}) => ({ enabled: true, startsAt: null, endsAt: null, renderable: true, ...over });
  it("ligado e dentro do período = no ar (início inclusivo, fim exclusivo)", () => {
    expect(bannerStatus(b(), NOW)).toBe("no_ar");
    expect(bannerStatus(b({ startsAt: NOW }), NOW)).toBe("no_ar");
    expect(bannerStatus(b({ endsAt: NOW }), NOW)).toBe("encerrado");
    expect(bannerStatus(b({ startsAt: "2026-11-27T10:01" }), NOW)).toBe("agendado");
    expect(bannerStatus(b({ startsAt: "2026-11-01T00:00", endsAt: "2026-12-01T00:00" }), NOW)).toBe("no_ar");
  });
  it("desligado e incompleto", () => {
    expect(bannerStatus(b({ enabled: false, endsAt: "2020-01-01T00:00" }), NOW)).toBe("desligado");
    expect(bannerStatus(b({ renderable: false }), NOW)).toBe("incompleto");
  });
});

describe("avisos do painel", () => {
  const NOW = "2026-11-27T10:00";
  const draft = (over: Partial<BannerDraft> = {}): BannerDraft => ({
    layout: "tipografico",
    title: "Sua história, nosso olhar.",
    alt: "",
    buttonLabel: "Conheça a NÓS",
    buttonUrl: "/sobre",
    secondaryLabel: "",
    secondaryUrl: "",
    desktop: null,
    mobile: null,
    hasVideo: false,
    enabled: true,
    startsAt: null,
    endsAt: null,
    ...over,
  });
  const good = { desktop: { width: 1920, height: 800 }, mobile: { width: 1080, height: 1350 } };

  it("banner completo não gera aviso", () => {
    expect(bannerWarnings(draft(), NOW, SITE)).toEqual([]);
    expect(bannerWarnings(draft({ layout: "midia", ...good }), NOW, SITE)).toEqual([]);
    expect(bannerWarnings(draft({ layout: "peca", alt: "Arte de fim de ano: agenda aberta para 2027", ...good }), NOW, SITE)).toEqual([]);
  });
  it("imagem fora da proporção sugerida (tolerância de 3%) e imagem pequena", () => {
    expect(bannerImageIssue({ width: 1920, height: 800 }, "desktop")).toBeNull();
    expect(bannerImageIssue({ width: 2400, height: 1000 }, "desktop")).toBeNull();
    expect(bannerImageIssue({ width: 1920, height: 820 }, "desktop")).toBeNull(); // 2,4% de diferença
    expect(bannerImageIssue({ width: 1920, height: 1080 }, "desktop")).toMatch(/fora da proporção sugerida \(1920 × 800 px\)/);
    expect(bannerImageIssue({ width: 1080, height: 1080 }, "mobile")).toMatch(/celular.*1080 × 1350 px/);
    expect(bannerImageIssue({ width: 960, height: 400 }, "desktop")).toMatch(/pequena/);
    expect(bannerImageIssue(null, "desktop")).toBeNull();
    expect(bannerWarnings(draft({ layout: "midia", desktop: { width: 1920, height: 1080 }, mobile: good.mobile }), NOW).some((w) => w.includes("fora da proporção"))).toBe(true);
  });
  it("peça pronta sem texto alternativo", () => {
    const withTitle = bannerWarnings(draft({ layout: "peca", ...good }), NOW);
    expect(withTitle.some((w) => w.startsWith("Peça pronta sem texto alternativo"))).toBe(true);
    expect(bannerWarnings(draft({ layout: "peca", title: "", ...good }), NOW).some((w) => w.includes("fica sem o conteúdo da arte"))).toBe(true);
    expect(pieceAccessibleName({ alt: " ", title: " Título " })).toBe("Título");
    expect(pieceAccessibleName({ alt: "Descrição", title: "Título" })).toBe("Descrição");
  });
  it("banner ligado fora da janela de exibição", () => {
    expect(bannerWarnings(draft({ endsAt: "2026-11-27T09:00" }), NOW).some((w) => w.includes("já terminou"))).toBe(true);
    expect(bannerWarnings(draft({ startsAt: "2026-12-24T08:00" }), NOW).some((w) => w.includes("ainda não começou"))).toBe(true);
    // desligado: é rascunho, não há o que avisar sobre datas
    expect(bannerWarnings(draft({ enabled: false, endsAt: "2026-11-27T09:00" }), NOW)).toEqual([]);
  });
  it("falta do mínimo, versões de imagem e vídeo sem capa", () => {
    expect(bannerWarnings(draft({ title: "" }), NOW)[0]).toMatch(/precisa de um título/);
    expect(bannerWarnings(draft({ layout: "midia" }), NOW)[0]).toMatch(/imagem ou um vídeo/);
    expect(bannerWarnings(draft({ layout: "peca" }), NOW)[0]).toMatch(/arte da peça/);
    expect(bannerWarnings(draft({ layout: "midia", desktop: good.desktop }), NOW).some((w) => w.includes("Sem a versão de celular"))).toBe(true);
    expect(bannerWarnings(draft({ layout: "midia", hasVideo: true }), NOW).some((w) => w.includes("Vídeo sem imagem de capa"))).toBe(true);
  });
  it("botão apontando para página fora do ar", () => {
    const warnings = bannerWarnings(draft({ buttonLabel: "Explore nosso portfólio", buttonUrl: "/portfolio" }), NOW, LAUNCH);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/“Explore nosso portfólio” aponta para \/portfolio.*leva a \/servicos/);
    expect(bannerWarnings(draft({ buttonUrl: "/portfolio" }), NOW, SITE)).toEqual([]);
  });
});
