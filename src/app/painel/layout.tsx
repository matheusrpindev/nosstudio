import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Shell, ShellFallback } from "./_shell/shell";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel NÓS Studio" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // necessário para `env(safe-area-inset-bottom)` valer na barra inferior do celular
  viewportFit: "cover",
  // preto oficial (token `preto`): a barra do navegador acompanha o tema escuro do painel
  themeColor: "#101014",
};

/**
 * Cache Components: ler a sessão é trabalho de requisição, então o painel inteiro fica atrás de um <Suspense>
 * e não promete navegação instantânea (as páginas leem o banco direto, sem cache).
 */
export const instant = false;

/**
 * `connection()` ANTES de tudo: o documento do painel é renderizado inteiro a cada requisição, sem casca
 * estática do build. É o que permite a Content-Security-Policy com nonce (src/proxy.ts): o Next só põe o nonce
 * nos scripts que renderiza na hora — os de uma casca pré-renderizada sairiam sem ele e seriam bloqueados.
 * (O painel já era todo dinâmico; a única perda é a casca instantânea do primeiro carregamento.)
 */
export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  await connection();
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
