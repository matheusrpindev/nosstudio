/**
 * Medição de visitas — regras PURAS (sem banco, sem Next): o que é robô, de onde a visita veio, em que aparelho
 * e qual página conta. Testadas em `classify.test.ts`. Quem grava é `src/server/metrics/collect.ts`.
 */
import { TRACK_EVENT_TYPES, type TrackEventType, type VisitDevice, type VisitSource } from "@/lib/domain";
import { SITE_PATHS } from "@/lib/site/paths";

/** Uma visita termina depois de 30 minutos sem atividade; a página seguinte abre uma visita nova. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Sessões brutas ficam guardadas por este prazo; depois só restam os totais diários. */
export const VISIT_SESSION_RETENTION_DAYS = 30;

// --------------------------------------------------------------------- robôs
/**
 * Programas que se identificam como robô, monitor, pré-visualizador de link ou navegador automatizado.
 * (`(?<!cu)bot`: "CUBOT" é marca de celular.) Navegadores dentro de aplicativos (Instagram, Facebook) são
 * pessoas e NÃO entram aqui.
 */
const BOT_PATTERN = new RegExp(
  [
    "(?<!cu)bot(?![a-z])",
    "crawl",
    "spider",
    "slurp",
    "scrap(er|y)",
    "headless",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "webdriver",
    "lighthouse",
    "pagespeed",
    "gtmetrix",
    "pingdom",
    "uptime",
    "statuscake",
    "monitor",
    "site24x7",
    "datadog",
    "newrelic",
    "nagios",
    "zabbix",
    "preview",
    "facebookexternalhit",
    "facebookcatalog",
    "meta-external",
    "whatsapp/",
    "embedly",
    "quora link",
    "google-inspectiontool",
    "google-read-aloud",
    "googleother",
    "feedfetcher",
    "mediapartners",
    "apis-google",
    "duckduckgo-favicons",
    "ia_archiver",
    "archive\\.org",
    "wayback",
    "curl/",
    "wget",
    "httpie",
    "python",
    "java/",
    "go-http",
    "node-fetch",
    "undici",
    "axios",
    "okhttp",
    "libwww",
    "postman",
    "insomnia",
    "ptst",
    "cypress",
    "electron",
  ].join("|"),
  "i",
);

/** `true` para o que não deve contar como visita: sem identificação, cliente que não é navegador, ou robô declarado. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  // todo navegador de verdade se apresenta como "Mozilla/5.0 (…)"
  if (ua.length < 30 || !/^Mozilla\/\d/.test(ua)) return true;
  return BOT_PATTERN.test(ua);
}

/** O navegador avisou que está só pré-carregando (a pessoa ainda não abriu a página). */
export function isPrefetchRequest(headers: Pick<Headers, "get">): boolean {
  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-purpose") ?? ""} ${headers.get("x-moz") ?? ""}`;
  return /prefetch|prerender|preview/i.test(purpose);
}

// ------------------------------------------------------------------ aparelho
/** Celular, tablet ou computador — pelo que o navegador declara; a largura da tela decide quando ele não diz. */
export function classifyDevice(userAgent: string | null | undefined, screenWidth?: number | null): VisitDevice {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle/.test(ua) || (ua.includes("android") && !ua.includes("mobi"))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/.test(ua)) return "celular";
  if (typeof screenWidth === "number" && screenWidth > 0 && screenWidth < 600) return "celular";
  return "computador";
}

// -------------------------------------------------------------------- origem
const SEARCH_HOSTS = /(^|\.)(google\.[a-z.]{2,6}|bing\.com|duckduckgo\.com|yahoo\.com|yahoo\.com\.br|ecosia\.org|search\.brave\.com|yandex\.[a-z.]{2,6}|baidu\.com|startpage\.com|qwant\.com|ask\.com|aol\.com)$/;
const SOCIAL_HOSTS =
  /(^|\.)(instagram\.com|facebook\.com|fb\.com|fb\.me|messenger\.com|t\.co|twitter\.com|x\.com|tiktok\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|pinterest\.[a-z.]{2,6}|pin\.it|whatsapp\.com|wa\.me|t\.me|telegram\.org|threads\.net|threads\.com|reddit\.com|linktr\.ee|kwai\.com|snapchat\.com|bsky\.app)$/;
/** Aplicativos Android que abrem o site (o navegador informa `android-app://<pacote>`). */
const ANDROID_APPS: Record<string, { host: string; source: VisitSource }> = {
  "com.google.android.googlequicksearchbox": { host: "google.com", source: "busca" },
  "com.google.android.gm": { host: "gmail (aplicativo)", source: "sites" },
  "com.instagram.android": { host: "instagram.com", source: "social" },
  "com.facebook.katana": { host: "facebook.com", source: "social" },
  "com.facebook.orca": { host: "messenger.com", source: "social" },
  "com.whatsapp": { host: "whatsapp.com", source: "social" },
  "com.linkedin.android": { host: "linkedin.com", source: "social" },
  "com.zhiliaoapp.musically": { host: "tiktok.com", source: "social" },
  "com.twitter.android": { host: "x.com", source: "social" },
  "org.telegram.messenger": { host: "t.me", source: "social" },
};

/** Só o domínio, em minúsculas e sem prefixos de versão móvel (`www.`, `m.`, `l.`…). Vazio se não for um domínio. */
export function normalizeReferrerHost(raw: string | null | undefined): string {
  let host = (raw ?? "").trim().toLowerCase();
  if (!host || host.length > 100) return "";
  // tolera receber uma URL inteira: fica só o domínio
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/[/?#].*$/, "").replace(/:\d+$/, "").replace(/^[^@]*@/, "");
  if (ANDROID_APPS[host]) return host;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return "";
  return host.replace(/^(www|m|l|lm|mobile|out|away)\./, "");
}

/** Texto de UTM: minúsculas, sem caracteres estranhos, até 60 caracteres. */
export function cleanCampaignText(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ._-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export type VisitOrigin = { source: VisitSource; referrerHost: string; campaign: string };

/**
 * De onde a visita veio. Link com UTM é campanha (vale mais que a referência); sem referência, ou com referência
 * do próprio site, é acesso direto; o resto se divide em busca, redes sociais e outros sites.
 */
export function classifyOrigin(input: { referrerHost?: string | null; siteHost?: string | null; utmSource?: string | null; utmMedium?: string | null; utmCampaign?: string | null }): VisitOrigin {
  const siteHost = normalizeReferrerHost(input.siteHost);
  let host = normalizeReferrerHost(input.referrerHost);
  if (host && host === siteHost) host = "";
  const app = ANDROID_APPS[host];
  if (app) host = app.host;

  const utmSource = cleanCampaignText(input.utmSource);
  const utmMedium = cleanCampaignText(input.utmMedium);
  const utmCampaign = cleanCampaignText(input.utmCampaign);
  if (utmSource || utmMedium || utmCampaign) {
    const campaign = utmCampaign || [utmSource, utmMedium].filter(Boolean).join(" / ");
    return { source: "campanha", referrerHost: host, campaign };
  }
  if (!host) return { source: "direto", referrerHost: "", campaign: "" };
  if (app) return { source: app.source, referrerHost: host, campaign: "" };
  if (SEARCH_HOSTS.test(host)) return { source: "busca", referrerHost: host, campaign: "" };
  if (SOCIAL_HOSTS.test(host)) return { source: "social", referrerHost: host, campaign: "" };
  return { source: "sites", referrerHost: host, campaign: "" };
}

// -------------------------------------------------------------------- página
/** Áreas que nunca entram na contagem: painel, áreas privadas, telas de acesso, arquivos e rotas internas. */
const EXCLUDED_PREFIXES = ["/painel", "/equipe", "/cliente", "/login", "/recuperar-senha", "/redefinir-senha", "/convite", "/conta", "/media", "/api", "/_next", "/og"];

/** Chave usada para qualquer endereço que não é uma página publicada (404, link quebrado). */
export const NOT_FOUND_PAGE_KEY = "(página não encontrada)";
/** Chave que recebe o excedente quando um recorte passa do limite diário de chaves diferentes. */
export const OTHER_KEY = "(outros)";

/** Caminho limpo (sem domínio, busca ou âncora; sem barra no fim). `null` = inválido ou área que não conta. */
export function normalizeVisitPath(raw: string | null | undefined): string | null {
  let path = (raw ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 300) return null;
  path = path.replace(/[?#].*$/, "");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path === "") path = "/";
  if (/[\s\\<>"'`]/.test(path) || path.includes("//")) return null;
  const lower = path.toLowerCase();
  if (EXCLUDED_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`))) return null;
  return path;
}

const STATIC_PAGES: ReadonlySet<string> = new Set(
  (Object.entries(SITE_PATHS) as [keyof typeof SITE_PATHS, string][]).filter(([key]) => key !== "clientArea").map(([, path]) => path),
);

/**
 * A página que entra no relatório: só endereços que existem no site. `slugs` = serviços e projetos publicados.
 * Qualquer outro caminho cai em `NOT_FOUND_PAGE_KEY` (a visita conta; o endereço digitado não é guardado).
 */
export function publicPageKey(path: string, slugs: { services: readonly string[]; portfolio: readonly string[] }): string {
  if (STATIC_PAGES.has(path)) return path;
  const service = /^\/servicos\/([a-z0-9-]{1,120})$/.exec(path);
  if (service && slugs.services.includes(service[1])) return path;
  const project = /^\/portfolio\/([a-z0-9-]{1,120})$/.exec(path);
  if (project && slugs.portfolio.includes(project[1])) return path;
  return NOT_FOUND_PAGE_KEY;
}

// -------------------------------------------------------------------- clique
export type TrackEvent = { type: TrackEventType; target: string; key: string };

/** `data-track="<tipo>:<alvo>"` → evento válido (`whatsapp:flutuante`, `banner:12`) ou `null`. */
export function parseTrackEvent(raw: string | null | undefined): TrackEvent | null {
  const match = /^([a-z]{2,20}):([a-z0-9][a-z0-9_-]{0,39})$/.exec((raw ?? "").trim());
  if (!match) return null;
  const type = match[1] as TrackEventType;
  if (!(TRACK_EVENT_TYPES as readonly string[]).includes(type)) return null;
  // banner é sempre o id do banner
  if (type === "banner" && !/^[1-9]\d{0,8}$/.test(match[2])) return null;
  return { type, target: match[2], key: `${type}:${match[2]}` };
}
