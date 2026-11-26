"use client";

import { Menu, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/cn";
import { ALL_NAV_ITEMS, isNavItemActive, MOBILE_SHORTCUTS, sectionTitle, type NavBadges } from "../nav";
import { NavList } from "./nav-list";

type MobileNavProps = {
  /** `<Logo />` renderizado no servidor (é Server Component). */
  logo: ReactNode;
  badges: NavBadges;
  /** Bloco da conta (usuário, "Ver site", "Sair"), renderizado no servidor. */
  account: ReactNode;
};

const shortcuts = MOBILE_SHORTCUTS.map((href) => ALL_NAV_ITEMS.find((item) => item.href === href)).filter((item) => item !== undefined);

/** Navegação do painel abaixo de 1024px: barra superior, barra inferior com atalhos e a gaveta "Mais". */
export function MobileNav({ logo, badges, account }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const inShortcut = shortcuts.some((item) => isNavItemActive(item, pathname));

  return (
    <>
      <header className="bg-menu border-menu-borda sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b pr-1.5 pl-4 text-white lg:hidden">
        <Link href="/painel" aria-label="NÓS Studio — painel, visão geral" className="flex h-11 shrink-0 items-center focus-visible:outline-white">
          {logo}
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-white/25" />
        <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{sectionTitle(pathname)}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-campo hover:bg-white/10 focus-visible:outline-white"
        >
          <Menu aria-hidden="true" className="size-6" />
        </button>
      </header>

      <nav
        aria-label="Atalhos"
        className="border-borda fixed inset-x-0 bottom-0 z-30 border-t bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {shortcuts.map((item) => {
            const active = isNavItemActive(item, pathname);
            const count = item.badge ? (badges[item.badge] ?? 0) : 0;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className="group flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 outline-offset-[-3px]">
                  <span className={cn("relative flex h-7 w-12 items-center justify-center rounded-full transition-colors", active ? "bg-lima text-grafite" : "text-texto-suave group-hover:text-detalhe")}>
                    <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.4 : 2} />
                    {count > 0 ? (
                      <span className={cn("ring-superficie absolute -top-1 right-0 min-w-[1.125rem] rounded-full px-1 text-center text-[0.625rem] leading-[1.125rem] font-bold tabular-nums ring-2", active ? "bg-grafite text-lima" : "bg-lima text-grafite")}>
                        {count > 9 ? "9+" : count}
                        <span className="sr-only"> {count === 1 ? "novo" : "novos"}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className={cn("text-[0.6875rem] leading-4", active ? "text-primaria font-bold" : "text-texto-suave font-semibold")}>{item.shortLabel ?? item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className="group flex min-h-[3.75rem] w-full cursor-pointer flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 outline-offset-[-3px]"
            >
              <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", !inShortcut ? "bg-lima text-grafite" : "text-texto-suave group-hover:text-detalhe")}>
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </span>
              <span className={cn("text-[0.6875rem] leading-4", !inShortcut ? "text-primaria font-bold" : "text-texto-suave font-semibold")}>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={open} onOpenChange={setOpen} side="bottom" title="Menu do painel" hideHeader className="bg-menu border-menu-borda border-t text-white">
        <div className="flex min-h-0 flex-1 flex-col">
          <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/30" />
          <nav aria-label="Menu completo" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-4">
            <NavList badges={badges} onNavigate={close} touch />
          </nav>
          {/* links do bloco da conta fecham a gaveta ao navegar */}
          <div
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("[data-fechar-menu]")) close();
            }}
          >
            {account}
          </div>
        </div>
      </Drawer>
    </>
  );
}
