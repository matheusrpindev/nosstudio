/** Limites do formulário de projeto do portfólio. Arquivo puro: o schema (servidor) e os campos (cliente) usam os mesmos números. */
export const PORTFOLIO_LIMITS = {
  services: 20,
  gallery: 40,
  backstage: 24,
  beforeAfter: 8,
  extraVideos: 6,
  related: 6,
  caption: 200,
  originNote: 200,
  caseText: 3000,
} as const;
