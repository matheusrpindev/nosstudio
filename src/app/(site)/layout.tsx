import type { ReactNode } from "react";
import { SiteShell } from "@/components/site/site-shell";
import "./site.css";

/**
 * Layout do site público: barra de avisos, cabeçalho, conteúdo, rodapé e WhatsApp flutuante (ver SiteShell).
 * Fica ESTÁTICO: só lê dados pelas funções cacheadas de src/server/site/queries.ts.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
