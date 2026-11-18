/**
 * Moldura do site público: link de pular, dados estruturados, barra de avisos, cabeçalho, <main>, rodapé e
 * o botão flutuante de WhatsApp. Usada pelo layout de src/app/(site) e pelo 404.
 *
 * Tudo é lido pelas funções cacheadas de src/server/site/queries.ts — a moldura (e as páginas dentro dela)
 * fica estática. Nada de cookies(), headers() ou searchParams aqui.
 */
import { cacheLife } from "next/cache";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { todayISO } from "@/lib/dates";
import { BRAND_COLOR_HEX, type BrandColor } from "@/lib/domain";
import { env } from "@/lib/env";
import { instagramLink, safeHref, safeUrl, whatsAppLink } from "@/lib/format";
import { getAnnouncements, getSiteContent, getSiteNav, type PublicAnnouncement } from "@/server/site/queries";
import { AnnouncementBar, type AnnouncementView } from "./announcement-bar";
import { OrganizationJsonLd } from "./json-ld";
import { Icon } from "./marks";
import { RevealObserver } from "./reveal-observer";
import { SiteHeader } from "./site-header";
import { WhatsAppFloat } from "./whatsapp-float";

/** Ano corrente no fuso do estúdio. Em cache: `new Date()` solto quebraria o pré-render (Cache Components). */
async function currentYear(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return todayISO().slice(0, 4);
}

/** Cor do acento da barra de avisos: lima sobre fundos escuros; nunca lima sobre claro. */
function noticeMark(bg: BrandColor): string {
  if (bg === "roxo" || bg === "grafite") return BRAND_COLOR_HEX.lima;
  return bg === "lima" ? BRAND_COLOR_HEX.grafite : BRAND_COLOR_HEX.roxo;
}

function toAnnouncementView(item: PublicAnnouncement): AnnouncementView {
  return {
    id: item.id,
    version: item.version,
    message: item.message,
    linkLabel: item.linkLabel,
    href: safeHref(item.linkUrl),
    bg: BRAND_COLOR_HEX[item.bgColor] ?? BRAND_COLOR_HEX.roxo,
    fg: BRAND_COLOR_HEX[item.textColor] ?? BRAND_COLOR_HEX.branco,
    mark: noticeMark(item.bgColor),
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    dismissible: item.dismissible,
    pending: item.pending,
  };
}

export async function SiteShell({ children }: { children: ReactNode }) {
  const [content, nav, announcements, year] = await Promise.all([
    getSiteContent(),
    getSiteNav(),
    getAnnouncements(),
    currentYear(),
  ]);
  const { general, home, contactPage, visibility } = content;

  // Sem rótulo no painel, o botão do cabeçalho some (em vez de uma caixa lima vazia).
  const ctaLabel = home.closing.cta.label.trim();
  const cta = ctaLabel ? { label: ctaLabel, href: safeHref(home.closing.cta.href) || "/contato" } : null;
  const instagram = instagramLink(general.instagram);
  const whatsapp = whatsAppLink(general.whatsapp, general.whatsappMessage);
  const social = general.socialLinks
    .map((link) => ({ label: link.label, href: safeUrl(link.href) }))
    .filter((link) => link.label && link.href);

  return (
    <div className="site">
      <a className="s-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <OrganizationJsonLd />
      {/* Sem JavaScript: o menu móvel vira um atalho para a navegação do rodapé e o "fechar" dos avisos some. */}
      <noscript>
        <style>{`.s-header__menu,.s-notice__close{display:none!important}.s-header__menu-nojs{display:inline-flex}`}</style>
      </noscript>

      <AnnouncementBar items={announcements.map(toAnnouncementView)} timeZone={env.timezone} />

      <SiteHeader
        logo={<Logo variant="wordmark" label="" className="h-[1.875rem] lg:h-9" />}
        brandName={general.brandName}
        items={nav}
        cta={cta}
        extra={instagram ? { label: `Instagram — ${general.instagram}`, href: instagram, external: true } : null}
      />

      <main id="conteudo" tabIndex={-1} data-menu-inert className="flex-1 outline-none">
        {children}
      </main>

      <footer className="s-footer" id="rodape" data-tone="grafite" data-menu-inert>
        <div className="s-wrap">
          <div className="s-footer__grid">
            <div className="s-footer__brand">
              <Logo variant="completo" tone="branco" label={general.brandName} className="h-auto w-full" />
            </div>
            <nav className="s-footer__col s-footer__col--nav" id="rodape-nav" aria-label="Rodapé">
              <h2 className="s-meta">Navegação</h2>
              <ul>
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="s-footer__col s-footer__col--contact">
              <h2 className="s-meta">Contato</h2>
              <ul>
                {whatsapp ? (
                  <li>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </li>
                ) : null}
                {instagram ? (
                  <li>
                    <a href={instagram} target="_blank" rel="noopener noreferrer">
                      Instagram — {general.instagram}
                    </a>
                  </li>
                ) : null}
                {general.email ? (
                  <li>
                    <a href={`mailto:${general.email}`}>{general.email}</a>
                  </li>
                ) : null}
                {social.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <Link href="/privacidade">Política de Privacidade</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="s-footer__base">
            <p className="s-footer__sign">
              © {year} {home.closing.signature}
              {general.serviceArea ? ` ${general.serviceArea}.` : ""}
            </p>
            <p className="s-footer__slogan">{general.tagline}</p>
            <a className="s-footer__top" href="#conteudo">
              Voltar ao topo <Icon name="arrow-down" />
            </a>
          </div>
        </div>
      </footer>

      {visibility.whatsappFloat && whatsapp ? <WhatsAppFloat href={whatsapp} label={contactPage.whatsappLabel} /> : null}

      <RevealObserver />
    </div>
  );
}
