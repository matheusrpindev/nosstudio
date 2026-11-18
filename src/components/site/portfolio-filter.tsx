"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FilterOption = { value: string; label: string; count: number };

const subscribeNever = () => () => {};

/**
 * Filtro por categoria do portfólio, no cliente e sem recarregar. A grade (Server Component, vem em `children`)
 * já traz todos os projetos com `data-category`; este componente só troca o `data-filter` do invólucro e o CSS
 * (portfolio.css) esconde o que não combina. Sem JS os botões nem aparecem e a grade mostra tudo.
 */
export function PortfolioFilter({
  options,
  allLabel,
  total,
  groupLabel,
  children,
}: {
  options: FilterOption[];
  allLabel: string;
  total: number;
  groupLabel: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState("all");
  // Só mostra os botões depois da hidratação: sem JS eles não fariam nada.
  const ready = useSyncExternalStore(subscribeNever, () => true, () => false);
  const current = options.find((option) => option.value === active);
  const visibleCount = current ? current.count : total;

  return (
    <div className="portfolio" data-filter={active}>
      {ready && options.length > 1 ? (
        <div className="portfolio__bar" role="group" aria-label={groupLabel}>
          {[{ value: "all", label: allLabel, count: total }, ...options].map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn("portfolio__chip", option.value === active && "is-active")}
              aria-pressed={option.value === active}
              onClick={() => setActive(option.value)}
            >
              <span>{option.label}</span>
              <small aria-hidden="true">{option.count}</small>
            </button>
          ))}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {ready && options.length > 1 ? `${visibleCount} ${visibleCount === 1 ? "projeto" : "projetos"}` : ""}
      </p>
      {children}
    </div>
  );
}
