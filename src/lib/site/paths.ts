/**
 * Caminhos das páginas públicas (fonte única para menu, rodapé, sitemap e links internos). Arquivo puro.
 * As rotas antigas (/pacotes, /casamentos) redirecionam para as novas em next.config.ts.
 */
export const SITE_PATHS = {
  home: "/",
  about: "/sobre",
  services: "/servicos",
  plans: "/planos",
  portfolio: "/portfolio",
  events: "/eventos-e-casamentos",
  contact: "/contato",
  /** Entrada das áreas privadas (Área do Cliente, Área da Equipe e painel): o login encaminha cada conta. */
  clientArea: "/login",
  privacy: "/privacidade",
  terms: "/termos",
  cookies: "/cookies",
} as const;

/** Caminho da página de um serviço. */
export function servicePath(slug: string): string {
  return `${SITE_PATHS.services}/${slug}`;
}

/** id do formulário em cada página que tem um (âncora dos botões). */
export const FORM_ANCHORS = {
  contact: "formulario",
  events: "eventos-formulario",
  service: "servico-orcamento",
} as const;
