"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavItemActive, PANEL_NAV, type NavBadges } from "../nav";

type NavListProps = {
  badges: NavBadges;
  /** Chamado ao clicar num item (a gaveta do celular usa para fechar). */
  onNavigate?: () => void;
  /** Itens mais altos (alvo de toque ≥ 44px) — gaveta do celular. */
  touch?: boolean;
};

/** Grupos e itens do menu sobre fundo roxo. O item ativo (por prefixo de rota) fica em lima. */
export function NavList({ badges, onNavigate, touch }: NavListProps) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      {PANEL_NAV.map((group) => (
        <div key={group.label}>
          <p className="text-lavanda/75 px-3 pb-1.5 text-[0.6875rem] font-bold tracking-[0.14em] uppercase">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isNavItemActive(item, pathname);
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-campo px-3 text-sm transition-colors focus-visible:outline-white",
                      touch ? "min-h-11" : "min-h-9",
                      active ? "bg-lima text-texto font-bold" : "font-medium text-white/85 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-[1.125rem] shrink-0" strokeWidth={active ? 2.4 : 2} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {count > 0 ? (
                      <span className={cn("rounded-full px-2 text-xs leading-5 font-bold tabular-nums", active ? "bg-grafite text-lima" : "bg-lima text-texto")}>
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> {count === 1 ? "novo" : "novos"}</span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
