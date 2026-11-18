"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./marks";

export type HeaderLink = { label: string; href: string };

type SiteHeaderProps = {
  /** O <Logo /> (Server Component) entra por aqui — não importe o logo dentro deste arquivo. */
  logo: ReactNode;
  brandName: string;
  items: HeaderLink[];
  /** Botão destacado ("Vamos conversar" → /contato). */
  cta: HeaderLink;
  /** Link extra no rodapé do menu móvel (ex.: Instagram). */
  extra?: (HeaderLink & { external?: boolean }) | null;
};

const DESKTOP = "(min-width: 1024px)";

function isCurrent(pathname: string, href: string): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Cabeçalho fixo do site: logo, navegação, botão destacado e o menu de tela cheia no celular
 * (aria-expanded, foco no primeiro link ao abrir, Esc fecha e devolve o foco, resto da página fica inerte).
 */
export function SiteHeader(props: SiteHeaderProps) {
  // `usePathname` pode suspender em rotas com parâmetro dinâmico; o fallback é o mesmo cabeçalho, sem item ativo.
  return (
    <Suspense fallback={<HeaderView {...props} pathname="" />}>
      <HeaderWithPath {...props} />
    </Suspense>
  );
}

function HeaderWithPath(props: SiteHeaderProps) {
  return <HeaderView {...props} pathname={usePathname() ?? ""} />;
}

function HeaderView({ logo, brandName, items, cta, extra, pathname }: SiteHeaderProps & { pathname: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);

  function close(returnFocus: boolean) {
    restoreFocus.current = returnFocus;
    setOpen(false);
  }

  useEffect(() => {
    const root = document.documentElement;
    const outside = document.querySelectorAll<HTMLElement>("[data-menu-inert]");
    if (!open) {
      if (restoreFocus.current) buttonRef.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
      return;
    }

    const measure = () => {
      const bottom = headerRef.current?.getBoundingClientRect().bottom ?? 64;
      root.style.setProperty("--s-menu-top", `${Math.round(bottom)}px`);
    };
    measure();
    root.classList.add("s-menu-open");
    outside.forEach((el) => (el.inert = true));
    navRef.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      restoreFocus.current = true;
      setOpen(false);
    };
    const desktop = window.matchMedia(DESKTOP);
    const onDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    desktop.addEventListener("change", onDesktop);
    return () => {
      root.classList.remove("s-menu-open");
      outside.forEach((el) => (el.inert = false));
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open]);

  return (
    <header className="s-header" ref={headerRef}>
      <div className="s-wrap s-header__in">
        <Link
          href="/"
          className="s-header__brand"
          aria-label={`${brandName} — página inicial`}
          data-site-brand
          onClick={() => close(false)}
        >
          {logo}
        </Link>

        <nav className="s-nav" id={menuId} ref={navRef} aria-label="Principal" data-tone="roxo" data-open={open ? "true" : undefined}>
          <ul className="s-nav__list">
            {items.map((item, i) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={() => close(false)}>
                  <span className="s-nav__n" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="s-nav__base">
            <Link href={cta.href} className="s-btn s-btn--primary" onClick={() => close(false)}>
              <span>{cta.label}</span>
              <Icon name="arrow" />
            </Link>
            {extra ? (
              <a
                href={extra.href}
                className="s-nav__extra"
                {...(extra.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {extra.label}
              </a>
            ) : null}
          </div>
        </nav>

        <Link href={cta.href} className="s-btn s-btn--primary s-btn--sm s-header__cta--d">
          {cta.label}
        </Link>
        <Link href={cta.href} className="s-btn s-btn--primary s-btn--sm s-header__cta--m" onClick={() => close(false)}>
          {cta.label}
        </Link>
        <button
          type="button"
          className="s-header__menu"
          ref={buttonRef}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => (open ? close(true) : setOpen(true))}
        >
          <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
          <span className="s-header__menu-ico" aria-hidden="true" />
        </button>
        <a className="s-header__menu-nojs" href="#rodape-nav">
          Menu
        </a>
      </div>
    </header>
  );
}
