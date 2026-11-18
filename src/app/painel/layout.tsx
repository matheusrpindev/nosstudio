import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Shell, ShellFallback } from "./_shell/shell";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel NÓS Studio" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // necessário para `env(safe-area-inset-bottom)` valer na barra inferior do celular
  viewportFit: "cover",
  themeColor: "#3b1f8e",
};

/**
 * Cache Components: ler a sessão é trabalho de requisição, então o painel inteiro fica atrás de um <Suspense>
 * e não promete navegação instantânea (as páginas leem o banco direto, sem cache).
 */
export const instant = false;

export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
