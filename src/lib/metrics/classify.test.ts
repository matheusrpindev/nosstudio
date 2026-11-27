import { describe, expect, it } from "vitest";
import { parseBeacon } from "./beacon";
import { classifyDevice, classifyOrigin, cleanCampaignText, isBotUserAgent, isPrefetchRequest, normalizeReferrerHost, normalizeVisitPath, NOT_FOUND_PAGE_KEY, parseTrackEvent, publicPageKey } from "./classify";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const INSTAGRAM = `${IPHONE} Instagram 356.0.0.31.90 (iPhone15,2; iOS 18_1; pt_BR; pt; scale=3.00; 1179x2556; 664612345)`;

describe("filtro de robôs", () => {
  it("navegadores de pessoas contam — inclusive o navegador de dentro do Instagram", () => {
    for (const ua of [CHROME, IPHONE, ANDROID, IPAD, ANDROID_TABLET, INSTAGRAM]) expect(isBotUserAgent(ua), ua).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 12; CUBOT NOTE 30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")).toBe(false);
  });

  it("robôs, monitores, pré-visualizadores e navegadores automatizados não contam", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Chrome-Lighthouse",
      "Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
      "Mozilla/5.0 (compatible; Pingdom.com_bot_version_1.4_(http://www.pingdom.com/))",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0 A",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
      "curl/8.5.0",
      "python-requests/2.32.3",
      "node",
      "",
    ];
    for (const ua of bots) expect(isBotUserAgent(ua), ua).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });

  it("pré-carregamento não conta", () => {
    expect(isPrefetchRequest(new Headers({ "Sec-Purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ Purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "X-Moz": "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ Accept: "*/*" }))).toBe(false);
  });
});

describe("aparelho", () => {
  it("celular, tablet e computador pelo navegador", () => {
    expect(classifyDevice(IPHONE, 390)).toBe("celular");
    expect(classifyDevice(ANDROID, 412)).toBe("celular");
    expect(classifyDevice(IPAD, 820)).toBe("tablet");
    expect(classifyDevice(ANDROID_TABLET, 800)).toBe("tablet");
    expect(classifyDevice(CHROME, 1920)).toBe("computador");
  });

  it("navegador que não se declara: a largura da tela decide", () => {
    expect(classifyDevice("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36", 360)).toBe("celular");
    expect(classifyDevice("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36", undefined)).toBe("computador");
  });
});

describe("origem da visita", () => {
  const site = "www.nosstudio.com.br";
  const origin = (referrerHost?: string, utm: { utmSource?: string; utmMedium?: string; utmCampaign?: string } = {}) => classifyOrigin({ referrerHost, siteHost: site, ...utm });

  it("sem referência (ou vinda do próprio site) é acesso direto", () => {
    expect(origin()).toEqual({ source: "direto", referrerHost: "", campaign: "" });
    expect(origin("nosstudio.com.br").source).toBe("direto");
    expect(origin("www.nosstudio.com.br").source).toBe("direto");
    expect(origin("isto não é um domínio").source).toBe("direto");
  });

  it("buscadores", () => {
    expect(origin("www.google.com")).toEqual({ source: "busca", referrerHost: "google.com", campaign: "" });
    expect(origin("www.google.com.br").source).toBe("busca");
    expect(origin("bing.com").source).toBe("busca");
    expect(origin("duckduckgo.com").source).toBe("busca");
    expect(origin("com.google.android.googlequicksearchbox")).toEqual({ source: "busca", referrerHost: "google.com", campaign: "" });
  });

  it("redes sociais (os domínios de redirecionamento contam como a rede)", () => {
    expect(origin("l.instagram.com")).toEqual({ source: "social", referrerHost: "instagram.com", campaign: "" });
    expect(origin("m.facebook.com").referrerHost).toBe("facebook.com");
    expect(origin("lm.facebook.com").source).toBe("social");
    expect(origin("t.co").source).toBe("social");
    expect(origin("www.tiktok.com").source).toBe("social");
    expect(origin("linktr.ee").source).toBe("social");
    expect(origin("com.instagram.android").referrerHost).toBe("instagram.com");
  });

  it("outros sites", () => {
    expect(origin("blog.exemplo.com.br")).toEqual({ source: "sites", referrerHost: "blog.exemplo.com.br", campaign: "" });
    // parecido com um buscador, mas não é
    expect(origin("notgoogle.com.evil.example").source).toBe("sites");
  });

  it("link com UTM é campanha, mesmo vindo de uma rede social", () => {
    expect(origin("l.instagram.com", { utmSource: "Instagram", utmMedium: "Bio", utmCampaign: "Lançamento 2026" })).toEqual({ source: "campanha", referrerHost: "instagram.com", campaign: "lançamento 2026" });
    expect(origin(undefined, { utmSource: "newsletter", utmMedium: "email" }).campaign).toBe("newsletter / email");
  });

  it("só o domínio fica guardado, nunca a URL inteira", () => {
    expect(normalizeReferrerHost("https://www.google.com/search?q=segredo+de+alguem")).toBe("google.com");
    expect(normalizeReferrerHost("https://usuario:senha@exemplo.com:8443/caminho?token=abc#x")).toBe("exemplo.com");
    expect(normalizeReferrerHost("<script>")).toBe("");
    expect(normalizeReferrerHost("a".repeat(200) + ".com")).toBe("");
  });

  it("texto de campanha é limpo e limitado", () => {
    expect(cleanCampaignText("  Black   FRIDAY <b>2026</b>  ")).toBe("black friday b 2026 b");
    expect(cleanCampaignText("=cmd|' /C calc'!A0")).toBe("cmd c calc a0");
    expect(cleanCampaignText("x".repeat(200))).toHaveLength(60);
  });
});

describe("páginas que contam", () => {
  const slugs = { services: ["fotografia", "audiovisual"], portfolio: ["casamento-ana-e-joao"] };

  it("limpa o caminho: sem busca, âncora ou barra no fim", () => {
    expect(normalizeVisitPath("/")).toBe("/");
    expect(normalizeVisitPath("/servicos/?utm_source=x#topo")).toBe("/servicos");
    expect(normalizeVisitPath("/contato#formulario")).toBe("/contato");
  });

  it("painel, áreas privadas, telas de acesso, arquivos e rotas internas não contam", () => {
    for (const path of ["/painel", "/painel/leads/3", "/login", "/recuperar-senha", "/redefinir-senha", "/convite", "/conta/senha", "/equipe", "/cliente/projetos", "/media/abc.webp", "/api/visita", "/_next/static/x.js", "/Painel"]) {
      expect(normalizeVisitPath(path), path).toBeNull();
    }
    // prefixo parecido não é a área privada
    expect(normalizeVisitPath("/clientes-atendidos")).toBe("/clientes-atendidos");
  });

  it("recusa o que não é um caminho do site", () => {
    for (const path of ["", "servicos", "//evil.example/x", "https://evil.example", "/a b", "/<script>", "/" + "a".repeat(400)]) expect(normalizeVisitPath(path), path).toBeNull();
  });

  it("só páginas que existem entram no relatório; o resto vira 'página não encontrada'", () => {
    expect(publicPageKey("/", slugs)).toBe("/");
    expect(publicPageKey("/planos", slugs)).toBe("/planos");
    expect(publicPageKey("/servicos/fotografia", slugs)).toBe("/servicos/fotografia");
    expect(publicPageKey("/portfolio/casamento-ana-e-joao", slugs)).toBe("/portfolio/casamento-ana-e-joao");
    expect(publicPageKey("/servicos/nao-existe", slugs)).toBe(NOT_FOUND_PAGE_KEY);
    expect(publicPageKey("/qualquer-coisa-digitada", slugs)).toBe(NOT_FOUND_PAGE_KEY);
    // a entrada das áreas privadas não é página do site
    expect(publicPageKey("/login", slugs)).toBe(NOT_FOUND_PAGE_KEY);
  });
});

describe("cliques medidos (data-track)", () => {
  it("aceita o contrato <tipo>:<alvo>", () => {
    expect(parseTrackEvent("whatsapp:flutuante")).toEqual({ type: "whatsapp", target: "flutuante", key: "whatsapp:flutuante" });
    expect(parseTrackEvent("banner:12")).toEqual({ type: "banner", target: "12", key: "banner:12" });
  });

  it("recusa tipo desconhecido, banner sem id e texto livre", () => {
    for (const raw of ["", "whatsapp", "outro:coisa", "banner:abc", "banner:0", "whatsapp:<x>", "WHATSAPP:Flutuante", "whatsapp:" + "a".repeat(60), null]) {
      expect(parseTrackEvent(raw), String(raw)).toBeNull();
    }
  });
});

describe("validação do sinal (beacon)", () => {
  it("aceita página vista e clique", () => {
    expect(parseBeacon(JSON.stringify({ t: "p", p: "/servicos", r: "instagram.com", w: 390, us: "ig", um: "bio", uc: "x" }))).toMatchObject({ t: "p", p: "/servicos", w: 390 });
    expect(parseBeacon(JSON.stringify({ t: "p", p: "/" }))).toEqual({ t: "p", p: "/" });
    expect(parseBeacon(JSON.stringify({ t: "e", p: "/contato", e: "whatsapp:contato" }))).toMatchObject({ t: "e", e: "whatsapp:contato" });
  });

  it("recusa o que está malformado", () => {
    const bad = [
      "",
      "não é json",
      "[]",
      "null",
      JSON.stringify({ t: "x", p: "/" }),
      JSON.stringify({ t: "p" }),
      JSON.stringify({ t: "p", p: "sem-barra" }),
      JSON.stringify({ t: "p", p: "/", w: "390" }),
      JSON.stringify({ t: "p", p: "/", w: -1 }),
      JSON.stringify({ t: "p", p: "/", extra: "campo a mais" }),
      JSON.stringify({ t: "p", p: "/", ip: "203.0.113.9" }),
      JSON.stringify({ t: "e", p: "/" }),
      JSON.stringify({ t: "p", p: "/" + "a".repeat(400) }),
      JSON.stringify({ t: "p", p: "/", r: "x".repeat(2000) }),
    ];
    for (const body of bad) expect(parseBeacon(body), body.slice(0, 40)).toBeNull();
  });
});
