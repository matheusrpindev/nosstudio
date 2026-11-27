/**
 * Banners do carrossel da página inicial (briefing v2, seção 04) — tipos e regras puras, usadas pelo site, pelo
 * painel (prévia, avisos) e pelos testes. Banco: tabela `banners`; leitura pública: `getBanners()` em
 * src/server/site/queries.ts; edição: src/server/site/admin/banners.ts.
 */
import type { BannerLayout, BannerTone, BrandColor } from "@/lib/domain";
import { safeHref } from "@/lib/format";
import type { PublicImage } from "@/lib/media";
import { SITE_PATHS } from "./paths";

/** Medidas sugeridas das artes (briefing): desktop 1920 × 800 (12:5) e celular 1080 × 1350 (4:5). */
export const BANNER_SIZES = {
  desktop: { width: 1920, height: 800, label: "1920 × 800 px" },
  mobile: { width: 1080, height: 1350, label: "1080 × 1350 px" },
} as const;
export type BannerViewport = keyof typeof BANNER_SIZES;

/** Tempo em tela de cada banner, em segundos. */
export const BANNER_DURATION = { min: 3, max: 30, default: 7 } as const;

/** Quantos banners o carrossel mostra no máximo (os primeiros da ordem). Mais do que isso ninguém vê até o fim. */
export const BANNER_MAX_SLIDES = 8;

export type BannerLink = { label: string; href: string };
export type BannerVideo = { id: number; url: string; mime: string };

/** Um banner pronto para renderizar: links já validados e mídias já resolvidas. */
export type BannerView = {
  id: number;
  layout: BannerLayout;
  title: string;
  subtitle: string;
  /** Botão principal (em peça pronta, é o link do banner inteiro). */
  primary: BannerLink | null;
  secondary: BannerLink | null;
  desktop: PublicImage | null;
  mobile: PublicImage | null;
  video: BannerVideo | null;
  /** Descrição da imagem para leitores de tela. */
  alt: string;
  bgColor: BrandColor;
  tone: BannerTone;
  durationSeconds: number;
  /** Fim da janela de exibição no horário do estúdio (`YYYY-MM-DDTHH:mm`), para o navegador conferir de novo. */
  endsAt: string | null;
};

// ------------------------------------------------------------------ links
/** O que está publicado no site agora — decide para onde um botão pode levar. */
export type SiteAvailability = {
  /** Slugs dos serviços publicados. */
  services: readonly string[];
  /** Página /planos no ar (visível e com planos ou avulsos publicados). */
  plans: boolean;
  /** Página /portfolio no ar (visível e com projetos publicados). */
  portfolio: boolean;
  /** Slugs dos projetos publicados. */
  projects: readonly string[];
  /** Página /eventos-e-casamentos no ar. */
  events: boolean;
};

export type ResolvedHref = {
  /** Endereço final ("" = sem link). */
  href: string;
  /** Preenchido quando o endereço pedido não está no ar e o botão foi levado a outra página. */
  redirectedFrom: string | null;
};

const splitPath = (href: string) => {
  const cut = href.search(/[?#]/);
  const path = (cut === -1 ? href : href.slice(0, cut)).replace(/\/+$/, "") || "/";
  return { path, rest: cut === -1 ? "" : href.slice(cut) };
};

/**
 * Endereço final de um botão de banner. Um link interno para uma página que NÃO está no ar (portfólio ainda
 * oculto, planos ocultos, serviço despublicado) não pode levar o visitante a uma página vazia ou a um 404:
 * - /portfolio (e projetos) fora do ar → /servicos (ou /contato, se não houver serviço publicado);
 * - projeto que não existe mais → /portfolio;
 * - serviço que não existe mais → /servicos; sem nenhum serviço → /contato;
 * - /planos e /eventos-e-casamentos fora do ar → /contato.
 * Quando a página volta ao ar, o botão volta a apontar para ela sozinho (nada é regravado no banco).
 * Links externos e âncoras passam direto; link inválido vira "" (o botão não aparece).
 */
export function resolveBannerHref(raw: string | null | undefined, site: SiteAvailability): ResolvedHref {
  const href = safeHref(raw);
  if (!href || !href.startsWith("/")) return { href, redirectedFrom: null };
  const { path } = splitPath(href);
  const servicesHome = site.services.length > 0 ? SITE_PATHS.services : SITE_PATHS.contact;
  const moved = (to: string): ResolvedHref => ({ href: to, redirectedFrom: href });

  if (path === SITE_PATHS.portfolio || path.startsWith(`${SITE_PATHS.portfolio}/`)) {
    if (!site.portfolio) return moved(servicesHome);
    const slug = path.slice(SITE_PATHS.portfolio.length + 1);
    if (slug && !site.projects.includes(slug)) return moved(SITE_PATHS.portfolio);
  } else if (path === SITE_PATHS.services || path.startsWith(`${SITE_PATHS.services}/`)) {
    if (site.services.length === 0) return moved(SITE_PATHS.contact);
    const slug = path.slice(SITE_PATHS.services.length + 1);
    if (slug && !site.services.includes(slug)) return moved(SITE_PATHS.services);
  } else if (path === SITE_PATHS.plans) {
    if (!site.plans) return moved(SITE_PATHS.contact);
  } else if (path === SITE_PATHS.events) {
    if (!site.events) return moved(SITE_PATHS.contact);
  }
  return { href, redirectedFrom: null };
}

// ------------------------------------------------------------- o que renderiza
type Renderable = { layout: BannerLayout; title: string; hasImage: boolean; hasVideo: boolean };

/**
 * O banner tem o mínimo para aparecer? Só texto: precisa de título. Imagem/vídeo com texto: precisa de imagem ou
 * vídeo. Peça pronta: precisa da imagem. Um banner ligado que não passa aqui NÃO vai para o site (em vez de um
 * quadro vazio) — o painel avisa o motivo.
 */
export function isBannerRenderable(banner: Renderable): boolean {
  if (banner.layout === "tipografico") return banner.title.trim() !== "";
  if (banner.layout === "midia") return banner.hasImage || banner.hasVideo;
  return banner.hasImage;
}

// ------------------------------------------------------------------ situação
export type BannerStatus = "no_ar" | "agendado" | "encerrado" | "incompleto" | "desligado";

/** `now`: horário local do estúdio `YYYY-MM-DDTHH:mm` (`nowLocal()`). */
export function bannerStatus(banner: { enabled: boolean; startsAt: string | null; endsAt: string | null; renderable: boolean }, now: string): BannerStatus {
  if (!banner.enabled) return "desligado";
  if (banner.endsAt && banner.endsAt <= now) return "encerrado";
  if (!banner.renderable) return "incompleto";
  if (banner.startsAt && banner.startsAt > now) return "agendado";
  return "no_ar";
}

// -------------------------------------------------------------------- avisos
type Dimensions = { width: number | null; height: number | null } | null | undefined;

/** Diferença de proporção tolerada entre a imagem enviada e a medida sugerida (3%). */
const RATIO_TOLERANCE = 0.03;

/**
 * Aviso sobre a imagem enviada para uma versão do banner (ou `null` se está tudo certo): proporção diferente da
 * sugerida (a imagem será cortada ou ganhará faixas) ou resolução baixa para o tamanho em que aparece.
 */
export function bannerImageIssue(image: Dimensions, viewport: BannerViewport): string | null {
  if (!image?.width || !image.height) return null;
  const target = BANNER_SIZES[viewport];
  const wanted = target.width / target.height;
  const got = image.width / image.height;
  const where = viewport === "desktop" ? "computador" : "celular";
  if (Math.abs(got - wanted) / wanted > RATIO_TOLERANCE) {
    return `A imagem de ${where} tem ${image.width} × ${image.height} px, fora da proporção sugerida (${target.label}). Ela será cortada nas bordas — ou, em peça pronta, aparecerá com faixas da cor de fundo.`;
  }
  if (image.width < target.width * 0.6) {
    return `A imagem de ${where} tem ${image.width} × ${image.height} px: é pequena para o tamanho em que aparece e pode ficar borrada. O sugerido é ${target.label}.`;
  }
  return null;
}

export type BannerDraft = {
  layout: BannerLayout;
  title: string;
  alt: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  desktop: Dimensions;
  mobile: Dimensions;
  hasVideo: boolean;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

/** O texto que um leitor de tela recebe de uma peça pronta: a descrição da arte ou, na falta dela, o título. */
export function pieceAccessibleName(banner: { alt: string; title: string }): string {
  return banner.alt.trim() || banner.title.trim();
}

/**
 * Avisos do painel sobre um banner (lista e formulário). Não impedem salvar: orientam. `site` (opcional) permite
 * avisar quando um botão aponta para uma página que está fora do ar.
 */
export function bannerWarnings(banner: BannerDraft, now: string, site?: SiteAvailability): string[] {
  const warnings: string[] = [];
  const hasImage = Boolean(banner.desktop || banner.mobile);

  if (banner.layout === "tipografico" && !banner.title.trim()) warnings.push("Banner só de texto precisa de um título: sem ele, não aparece no site.");
  if (banner.layout === "midia" && !hasImage && !banner.hasVideo) warnings.push("Envie uma imagem ou um vídeo: sem mídia, este banner não aparece no site.");
  if (banner.layout === "peca" && !hasImage) warnings.push("Envie a arte da peça: sem imagem, este banner não aparece no site.");
  if (banner.layout === "peca" && hasImage && !banner.alt.trim()) {
    warnings.push(
      banner.title.trim()
        ? "Peça pronta sem texto alternativo: quem usa leitor de tela vai ouvir só o título. Descreva o que está escrito na arte."
        : "Peça pronta sem texto alternativo: quem não vê a imagem (leitores de tela, buscadores) fica sem o conteúdo da arte. Descreva o que está escrito nela.",
    );
  }
  if (banner.layout !== "tipografico") {
    if (banner.desktop && !banner.mobile) warnings.push(`Sem a versão de celular, o site usa a imagem de computador também no celular (cortada nas laterais). O sugerido é enviar uma arte de ${BANNER_SIZES.mobile.label}.`);
    if (!banner.desktop && banner.mobile) warnings.push(`Só há a versão de celular: no computador ela aparece cortada. Envie também a arte de ${BANNER_SIZES.desktop.label}.`);
    for (const viewport of ["desktop", "mobile"] as const) {
      const issue = bannerImageIssue(banner[viewport], viewport);
      if (issue) warnings.push(issue);
    }
    if (banner.hasVideo && banner.layout === "midia" && !hasImage) {
      warnings.push("Vídeo sem imagem de capa: quem pediu menos movimento ou economia de dados (e quem está com a conexão lenta) verá só a cor de fundo. Envie uma imagem para servir de capa.");
    }
    if (banner.hasVideo && banner.layout === "peca") warnings.push("Peça pronta não usa vídeo: o vídeo enviado fica guardado, mas não aparece.");
  }
  if (banner.layout === "peca" && hasImage && !safeHref(banner.buttonUrl)) warnings.push("Sem o endereço do botão principal, a peça não é clicável.");

  if (banner.enabled && banner.endsAt && banner.endsAt <= now) warnings.push("Está ligado, mas o período de exibição já terminou: não aparece mais no site. Mude as datas ou desligue o banner.");
  else if (banner.enabled && banner.startsAt && banner.startsAt > now) warnings.push("Está ligado, mas o período de exibição ainda não começou: entra no site sozinho na data de início.");

  if (site) {
    for (const [label, url] of [
      [banner.buttonLabel, banner.buttonUrl],
      [banner.secondaryLabel, banner.secondaryUrl],
    ] as const) {
      const resolved = resolveBannerHref(url, site);
      if (resolved.redirectedFrom) {
        warnings.push(`O botão “${label || resolved.redirectedFrom}” aponta para ${resolved.redirectedFrom}, que não está no ar agora. Enquanto isso ele leva a ${resolved.href}; quando a página for publicada, volta a apontar para ela sozinho.`);
      }
    }
  }
  return warnings;
}
