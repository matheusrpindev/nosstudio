/**
 * Em quais páginas do site um aviso da barra aparece (briefing v2, seção 04: "páginas"). Arquivo puro.
 * O aviso guarda uma lista de CHAVES de `SITE_PATHS` (`announcements.pages`); lista vazia = todas as páginas.
 */
import { SITE_PATHS } from "./paths";

/** Páginas que podem ser escolhidas, na ordem do menu. (A "Área do Cliente" é o login: não é página do site.) */
export const ANNOUNCEMENT_PAGE_KEYS = ["home", "about", "services", "plans", "portfolio", "events", "contact", "privacy", "terms", "cookies"] as const satisfies readonly (keyof typeof SITE_PATHS)[];
export type AnnouncementPageKey = (typeof ANNOUNCEMENT_PAGE_KEYS)[number];

export const ANNOUNCEMENT_PAGE_LABELS: Record<AnnouncementPageKey, string> = {
  home: "Página inicial",
  about: "Sobre a NÓS",
  services: "Serviços (lista e página de cada serviço)",
  plans: "Planos",
  portfolio: "Portfólio (lista e página de cada projeto)",
  events: "Eventos e Casamentos",
  contact: "Contato",
  privacy: "Política de privacidade",
  terms: "Termos de uso",
  cookies: "Política de cookies",
};

/** Rótulo curto para a lista do painel ("Só em: Contato, Planos"). */
export const ANNOUNCEMENT_PAGE_SHORT_LABELS: Record<AnnouncementPageKey, string> = {
  home: "Página inicial",
  about: "Sobre a NÓS",
  services: "Serviços",
  plans: "Planos",
  portfolio: "Portfólio",
  events: "Eventos e Casamentos",
  contact: "Contato",
  privacy: "Privacidade",
  terms: "Termos",
  cookies: "Cookies",
};

const isPageKey = (value: unknown): value is AnnouncementPageKey => typeof value === "string" && (ANNOUNCEMENT_PAGE_KEYS as readonly string[]).includes(value);

/**
 * Normaliza a lista vinda do banco ou do formulário: só chaves conhecidas, sem repetição, na ordem do menu.
 * Marcar TODAS as páginas é o mesmo que não marcar nenhuma — vira lista vazia ("todas"), que também cobre as
 * páginas que não estão na lista (404, páginas futuras).
 */
export function normalizeAnnouncementPages(value: unknown): AnnouncementPageKey[] {
  const picked = new Set(Array.isArray(value) ? value.filter(isPageKey) : []);
  if (picked.size === ANNOUNCEMENT_PAGE_KEYS.length) return [];
  return ANNOUNCEMENT_PAGE_KEYS.filter((key) => picked.has(key));
}

/** Caminhos (`/contato`…) das chaves escolhidas. Vazio = todas as páginas. */
export function announcementPaths(pages: readonly string[] | null | undefined): string[] {
  return normalizeAnnouncementPages(pages).map((key) => SITE_PATHS[key]);
}

const trimPath = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname) || "/";

/**
 * O aviso aparece nesta página? `paths` vazio = aparece em todas. A página inicial só casa com "/" exato; as
 * demais casam com a própria página e com as que ficam abaixo dela (`/servicos` vale para `/servicos/fotografia`).
 */
export function announcementMatchesPath(paths: readonly string[], pathname: string): boolean {
  if (paths.length === 0) return true;
  const current = trimPath(pathname);
  return paths.some((path) => (path === "/" ? current === "/" : current === path || current.startsWith(`${path}/`)));
}
