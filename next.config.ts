import type { NextConfig } from "next";
import { PUBLIC_CSP_SOURCE, publicCsp } from "./src/lib/security/csp";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Cabeçalhos de segurança. A Content-Security-Policy vem de src/lib/security/csp.ts:
 * - site público (estático): a política SEM nonce, aplicada aqui;
 * - painel, telas de acesso, /conta, /equipe e /cliente: a política COM nonce, gerada a cada requisição pelo
 *   proxy (src/proxy.ts) — por isso esses caminhos ficam de fora da regra abaixo (dois cabeçalhos CSP somariam
 *   as restrições das duas).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Janelas abertas a partir de outros sites não ficam com referência a esta (e vice-versa).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Permite gerar o build em outra pasta (ex.: testes de ponta a ponta) sem mexer no build principal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // Perfil de cache do conteúdo público (usado com `cacheLife("site")`): o painel invalida na hora com
  // `updateTag("site")`; a revalidação por tempo é só uma rede de segurança para mudanças feitas por fora.
  cacheLife: {
    site: { stale: 300, revalidate: 300, expire: 3600 },
  },
  poweredByHeader: false,
  serverExternalPackages: ["@libsql/client", "libsql", "@node-rs/argon2", "sharp"],
  experimental: {
    serverActions: {
      // uploads passam por Route Handler; as actions só carregam formulários de texto
      bodySizeLimit: "2mb",
    },
    // o proxy (src/proxy.ts) cobre /painel/**: sem isto, uploads acima de 10 MB seriam truncados
    proxyClientMaxBodySize: "32mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  /**
   * Rotas do site antigo (briefing v1) → rotas novas. Permanentes (308): buscadores e links salvos seguem para a
   * página nova. A query string (ex.: ?pacote=…) é preservada pelo Next.
   */
  async redirects() {
    return [
      { source: "/pacotes", destination: "/planos", permanent: true },
      { source: "/casamentos", destination: "/eventos-e-casamentos", permanent: true },
    ];
  },
  async headers() {
    return [
      // Tudo, exceto os arquivos enviados (que têm política própria logo abaixo).
      { source: "/((?!media/).*)", headers: securityHeaders },
      // CSP do site público (estático, sem nonce). Os ambientes privados recebem a deles do proxy.
      { source: PUBLIC_CSP_SOURCE, headers: [{ key: "Content-Security-Policy", value: publicCsp({ dev: isDev }) }] },
      // Uploads: nada servido daqui pode executar como página (os cabeçalhos do next.config têm
      // precedência sobre os da rota, então a política dos arquivos é definida aqui).
      {
        source: "/media/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      // Nada do painel (nem as telas de login e de senha) deve ser indexado.
      {
        source: "/painel/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path(login|recuperar-senha|redefinir-senha|convite)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // Troca de senha fora do painel (tela neutra) e os outros dois ambientes privados: Área da Equipe e Área
      // do Cliente. As rotas /equipe e /cliente ainda não existem; o cabeçalho já fica valendo para quando nascerem.
      {
        source: "/conta/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:area(equipe|cliente)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:area(equipe|cliente)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
