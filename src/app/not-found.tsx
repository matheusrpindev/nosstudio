import type { Metadata } from "next";
import Link from "next/link";
import { SiteButtonLink } from "@/components/site/button";
import { Icon } from "@/components/site/marks";
import { SiteShell } from "@/components/site/site-shell";
import { getSiteNav } from "@/server/site/queries";
import "./(site)/site.css";

export const metadata: Metadata = {
  title: "Página não encontrada · NÓS Studio",
  robots: { index: false, follow: false },
};

/** 404 com a cara do site: mesma moldura (cabeçalho e rodapé) e atalhos para as páginas que existem. */
export default async function NotFound() {
  const nav = await getSiteNav();
  return (
    <SiteShell>
      <div className="s-404">
        <div className="s-wrap">
          <div className="s-pagehead__meta">
            <p className="s-meta">Erro 404</p>
          </div>
          <div className="s-404__grid">
            <div className="s-404__main">
              <p className="s-404__code" aria-hidden="true">
                404
              </p>
              <h1 className="s-h2 mt-8">Essa página saiu de quadro.</h1>
              <p className="s-lead s-muted mt-5 max-w-xl">
                O endereço pode ter mudado ou nunca ter existido. Volte para o início ou escolha um caminho ao lado.
              </p>
              <div className="mt-8 grid gap-3 sm:flex">
                <SiteButtonLink href="/">Voltar para o início</SiteButtonLink>
                <SiteButtonLink href="/contato" variant="secondary">
                  Falar com a gente
                </SiteButtonLink>
              </div>
            </div>
            <nav className="s-404__nav" aria-label="Páginas do site">
              <h2 className="s-meta mb-3">Páginas do site</h2>
              <ul className="s-404__links">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      {item.label}
                      <Icon name="arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
