import type { Metadata } from "next";
import Link from "next/link";
import { SiteButtonLink } from "@/components/site/button";
import { Icon, PlayMark, ViewfinderFrame } from "@/components/site/marks";
import { SiteShell } from "@/components/site/site-shell";
import { getSiteContent, getSiteNav } from "@/server/site/queries";
import "./(site)/site.css";

export const metadata: Metadata = {
  title: "Página não encontrada · NÓS Studio",
  robots: { index: false, follow: false },
};

/**
 * 404 com a cara do site (briefing v2, seção 31): "Esse take saiu do roteiro. Mas toda boa história tem uma
 * segunda tomada." — o texto vem de Editar site › Textos › Página não encontrada. Mesma moldura (cabeçalho e
 * rodapé), a claquete "TAKE 404" no visor e atalhos para as páginas que existem.
 */
export default async function NotFound() {
  const [nav, { notFoundPage: page }] = await Promise.all([getSiteNav(), getSiteContent()]);
  return (
    <SiteShell>
      <div className="s-404">
        <div className="s-wrap">
          <div className="s-pagehead__meta">
            <p className="s-meta">{page.eyebrow}</p>
          </div>
          <div className="s-404__grid">
            <div className="s-404__main">
              <h1 className="s-d1 s-404__title">{page.title}</h1>
              {page.text ? <p className="s-lead s-404__text">{page.text}</p> : null}
              <div className="s-404__actions">
                <SiteButtonLink href={page.cta.href || "/"}>{page.cta.label}</SiteButtonLink>
              </div>
            </div>
            <div className="s-404__take" data-tone="roxo" aria-hidden="true">
              <ViewfinderFrame />
              <span className="s-rec s-404__rec">Take</span>
              <span className="s-404__code">404</span>
              <PlayMark className="s-404__play" />
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
