/**
 * Leitura do conteúdo PÚBLICO do site. Tudo aqui é cacheado ("use cache") com a tag `site`:
 * as páginas públicas ficam estáticas e são regeneradas quando o painel chama `invalidateSite()`.
 *
 * Regras:
 * - Só devolva o que pode aparecer para qualquer visitante (publicado/visível). Nada de dados internos.
 * - Se o banco ainda não existir (primeiro build), devolvemos os padrões/listas vazias em vez de quebrar.
 */
import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import {
  announcements,
  faqs,
  media,
  packages,
  portfolioProjects,
  services,
  siteContent,
  testimonials,
  type Announcement,
  type Faq,
  type Package,
  type PortfolioProject,
  type Service,
  type Testimonial,
} from "@/db/schema";
import { toPublicImage, type PublicImage } from "@/lib/media";
import { defaultSiteContent, resolveSiteContent, SITE_CONTENT_KEYS, type SiteContent } from "@/lib/site/content";
import { servableAnnouncements } from "./admin/announcement-status";
import { SITE_TAG } from "./cache";

/** Durante o build o banco pode não existir ainda: registra e segue com o valor de fallback. */
async function safely<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.warn(`[site] não foi possível ler "${label}" do banco — usando o padrão.`, (error as Error)?.message);
    return fallback;
  }
}

async function loadImages(ids: (number | null | undefined)[]): Promise<Map<number, PublicImage>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === "number"))];
  const map = new Map<number, PublicImage>();
  if (unique.length === 0) return map;
  const rows = await db.select().from(media).where(inArray(media.id, unique));
  for (const row of rows) {
    const image = toPublicImage(row);
    if (image) map.set(row.id, image);
  }
  return map;
}

// ------------------------------------------------------------ conteúdo fixo
/** Todas as seções editáveis do site (com os padrões do briefing onde nada foi salvo). */
export async function getSiteContent(): Promise<SiteContent> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  return safely("conteúdo", defaultSiteContent, async () => {
    const rows = await db.select().from(siteContent);
    const stored = new Map(rows.map((row) => [row.key, row.value]));
    const result = {} as Record<string, unknown>;
    for (const key of SITE_CONTENT_KEYS) result[key] = resolveSiteContent(key, stored.get(key));
    return result as SiteContent;
  });
}

/** Imagens referenciadas pelo conteúdo fixo (hero, fundadores, casal, casamentos, compartilhamento). */
export type SiteImages = {
  hero: PublicImage | null;
  couple: PublicImage | null;
  founders: (PublicImage | null)[];
  weddingsHero: PublicImage | null;
  share: PublicImage | null;
};

export async function getSiteImages(): Promise<SiteImages> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  const content = await getSiteContent();
  const empty: SiteImages = {
    hero: null,
    couple: null,
    founders: content.about.founders.map(() => null),
    weddingsHero: null,
    share: null,
  };
  return safely("imagens", empty, async () => {
    const founderIds = content.about.founders.map((f) => f.mediaId);
    const images = await loadImages([
      content.home.hero.mediaId,
      content.about.coupleMediaId,
      content.weddingsPage.heroMediaId,
      content.seo.shareImageMediaId,
      ...founderIds,
    ]);
    const pick = (id: number | null) => (id ? (images.get(id) ?? null) : null);
    return {
      hero: pick(content.home.hero.mediaId),
      couple: pick(content.about.coupleMediaId),
      founders: founderIds.map(pick),
      weddingsHero: pick(content.weddingsPage.heroMediaId),
      share: pick(content.seo.shareImageMediaId),
    };
  });
}

// ---------------------------------------------------------- barra de avisos
export type PublicAnnouncement = Pick<
  Announcement,
  "id" | "message" | "linkLabel" | "linkUrl" | "bgColor" | "textColor" | "startsAt" | "endsAt" | "dismissible"
> & {
  /** Muda quando o aviso é editado — um aviso fechado pelo visitante volta a aparecer se o texto mudar. */
  version: number;
  /** O início está a poucos minutos: vai no HTML ESCONDIDO e só o script da barra o revela na hora. */
  pending: boolean;
};

/**
 * Avisos ativados que estão no período — ou prestes a começar (ver `servableAnnouncements`). Um aviso agendado
 * para depois NÃO sai daqui: o texto não pode aparecer no código-fonte do site antes da data combinada.
 * A janela exata (início/fim) é conferida de novo no navegador pelo componente da barra, porque esta lista
 * fica em cache por alguns minutos.
 */
export async function getAnnouncements(): Promise<PublicAnnouncement[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  return safely("avisos", [], async () => {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.enabled, true))
      .orderBy(asc(announcements.sortOrder), desc(announcements.id));
    return servableAnnouncements(rows, new Date()).map((row) => ({
        id: row.id,
        message: row.message,
        linkLabel: row.linkLabel,
        linkUrl: row.linkUrl,
        bgColor: row.bgColor,
        textColor: row.textColor,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        dismissible: row.dismissible,
        version: row.updatedAt.getTime(),
        pending: row.pending,
      }));
  });
}

// ----------------------------------------------------------------- serviços
export type PublicService = Pick<
  Service,
  "id" | "slug" | "title" | "summary" | "description" | "items" | "ctaLabel" | "interest" | "videoUrl" | "pagePath"
> & { cover: PublicImage | null; gallery: PublicImage[] };

export async function getServices(): Promise<PublicService[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  return safely("serviços", [], async () => {
    const rows = await db
      .select()
      .from(services)
      .where(eq(services.visible, true))
      .orderBy(asc(services.sortOrder), asc(services.id));
    const images = await loadImages(rows.flatMap((row) => [row.coverMediaId, ...row.gallery]));
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description,
      items: row.items,
      ctaLabel: row.ctaLabel,
      interest: row.interest,
      videoUrl: row.videoUrl,
      pagePath: row.pagePath,
      cover: row.coverMediaId ? (images.get(row.coverMediaId) ?? null) : null,
      gallery: row.gallery.map((id) => images.get(id)).filter((image): image is PublicImage => Boolean(image)),
    }));
  });
}

// ------------------------------------------------------------------ pacotes
export type PublicPackage = Pick<
  Package,
  | "id"
  | "kind"
  | "name"
  | "tagline"
  | "description"
  | "includes"
  | "deliverables"
  | "recordingDuration"
  | "revisionLimit"
  | "priceMode"
  | "priceCents"
  | "priceSuffix"
  | "recommended"
  | "ctaLabel"
>;

export async function getPackages(): Promise<{ plans: PublicPackage[]; standalone: PublicPackage[] }> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  return safely("pacotes", { plans: [], standalone: [] }, async () => {
    const rows = await db
      .select()
      .from(packages)
      .where(eq(packages.visible, true))
      .orderBy(asc(packages.sortOrder), asc(packages.id));
    const toPublic = (row: Package): PublicPackage => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      includes: row.includes,
      deliverables: row.deliverables,
      recordingDuration: row.recordingDuration,
      revisionLimit: row.revisionLimit,
      priceMode: row.priceMode,
      // Preço só sai do banco quando o modo de exibição pede — "sob consulta" nunca expõe valor.
      priceCents: row.priceMode === "sob_consulta" ? null : row.priceCents,
      priceSuffix: row.priceMode === "sob_consulta" ? "" : row.priceSuffix,
      recommended: row.recommended,
      ctaLabel: row.ctaLabel,
    });
    return {
      plans: rows.filter((row) => row.kind === "plano").map(toPublic),
      standalone: rows.filter((row) => row.kind === "avulso").map(toPublic),
    };
  });
}

// ---------------------------------------------------------------------- FAQ
export type PublicFaq = Pick<Faq, "id" | "question" | "answer" | "showOnHome" | "showOnWeddings">;

/** Só perguntas publicadas E com resposta preenchida. */
export async function getFaqs(): Promise<PublicFaq[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  return safely("faq", [], async () => {
    const rows = await db
      .select()
      .from(faqs)
      .where(eq(faqs.published, true))
      .orderBy(asc(faqs.sortOrder), asc(faqs.id));
    return rows
      .filter((row) => row.answer.trim().length > 0)
      .map((row) => ({
        id: row.id,
        question: row.question,
        answer: row.answer,
        showOnHome: row.showOnHome,
        showOnWeddings: row.showOnWeddings,
      }));
  });
}

// ---------------------------------------------------------------- portfólio
export type PublicPortfolioProject = Pick<
  PortfolioProject,
  "id" | "slug" | "title" | "category" | "summary" | "description" | "servicesDone" | "videoUrl" | "projectDate" | "featured"
> & {
  /** Nome do cliente — só vem preenchido quando a exibição foi autorizada. */
  clientName: string;
  cover: PublicImage | null;
  gallery: PublicImage[];
};

/** Projetos publicados (vazio enquanto o portfólio estiver oculto nas configurações de visibilidade). */
export async function getPortfolio(): Promise<PublicPortfolioProject[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  const content = await getSiteContent();
  if (!content.visibility.portfolio) return [];
  return safely("portfólio", [], async () => {
    const rows = await db
      .select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.published, true))
      .orderBy(desc(portfolioProjects.featured), asc(portfolioProjects.sortOrder), desc(portfolioProjects.projectDate));
    const images = await loadImages(rows.flatMap((row) => [row.coverMediaId, ...row.gallery]));
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      summary: row.summary,
      description: row.description,
      servicesDone: row.servicesDone,
      videoUrl: row.videoUrl,
      projectDate: row.projectDate,
      featured: row.featured,
      clientName: row.showClient ? row.clientName : "",
      cover: row.coverMediaId ? (images.get(row.coverMediaId) ?? null) : null,
      gallery: row.gallery.map((id) => images.get(id)).filter((image): image is PublicImage => Boolean(image)),
    }));
  });
}

export async function getPortfolioProject(slug: string): Promise<PublicPortfolioProject | null> {
  const all = await getPortfolio();
  return all.find((project) => project.slug === slug) ?? null;
}

// -------------------------------------------------------------- depoimentos
export type PublicTestimonial = Pick<
  Testimonial,
  "id" | "kind" | "authorName" | "authorRole" | "content" | "mediaAlt" | "videoUrl"
> & { image: PublicImage | null };

/** Só depoimentos publicados E com autorização registrada (e apenas se a seção estiver ligada). */
export async function getTestimonials(): Promise<PublicTestimonial[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  const content = await getSiteContent();
  if (!content.visibility.testimonials) return [];
  return safely("depoimentos", [], async () => {
    const rows = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.published, true), eq(testimonials.authorized, true)))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.id));
    const images = await loadImages(rows.map((row) => row.mediaId));
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      authorName: row.authorName,
      authorRole: row.authorRole,
      content: row.content,
      mediaAlt: row.mediaAlt,
      videoUrl: row.videoUrl,
      image: row.mediaId ? (images.get(row.mediaId) ?? null) : null,
    }));
  });
}

// ------------------------------------------------- imagens em uso no site
/**
 * Ids das imagens que o site público pode exibir AGORA: exatamente as que saem das consultas acima (conteúdo
 * fixo, serviços visíveis, portfólio e depoimentos publicados). A rota /media usa esta lista: uma imagem pública
 * que nenhum conteúdo publicado usa (depoimento despublicado, projeto em rascunho, upload ainda não salvo) só é
 * entregue a quem está logado no painel — despublicar tira a imagem do ar, não só o texto.
 */
export async function getPublishedMediaIds(): Promise<number[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  const [images, serviceList, portfolio, testimonialList] = await Promise.all([getSiteImages(), getServices(), getPortfolio(), getTestimonials()]);
  const all: (PublicImage | null)[] = [
    images.hero,
    images.couple,
    images.weddingsHero,
    images.share,
    ...images.founders,
    ...serviceList.flatMap((service) => [service.cover, ...service.gallery]),
    ...portfolio.flatMap((project) => [project.cover, ...project.gallery]),
    ...testimonialList.map((testimonial) => testimonial.image),
  ];
  return [...new Set(all.flatMap((image) => (image ? [image.id] : [])))];
}

// ---------------------------------------------------------------- navegação
export type SiteNavItem = { label: string; href: string };

/** Itens do menu principal, já respeitando a visibilidade das seções e a existência de conteúdo. */
export async function getSiteNav(): Promise<SiteNavItem[]> {
  "use cache";
  cacheTag(SITE_TAG);
  cacheLife("site");
  const [content, pkgs, portfolio] = await Promise.all([getSiteContent(), getPackages(), getPortfolio()]);
  const items: SiteNavItem[] = [
    { label: "Início", href: "/" },
    { label: "Quem Somos", href: "/sobre" },
    { label: "Serviços", href: "/servicos" },
  ];
  if (content.visibility.packages && pkgs.plans.length + pkgs.standalone.length > 0) {
    items.push({ label: "Pacotes", href: "/pacotes" });
  }
  if (content.visibility.weddings) items.push({ label: "Casamentos", href: "/casamentos" });
  if (content.visibility.portfolio && portfolio.length > 0) items.push({ label: "Portfólio", href: "/portfolio" });
  items.push({ label: "Contato", href: "/contato" });
  return items;
}
