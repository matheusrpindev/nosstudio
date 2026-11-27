"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { PortfolioCategory } from "@/lib/domain";
import {
  filterPortfolio,
  parsePortfolioFilter,
  PORTFOLIO_SEARCH_MAX,
  portfolioFilterQuery,
  type PortfolioCategoryOption,
  type PortfolioFilter as FilterState,
} from "@/lib/site/portfolio";

export type PortfolioFilterLabels = {
  /** Nome do campo de pesquisa. */
  search: string;
  placeholder: string;
  /** Filtro "todas as categorias". */
  all: string;
  noResultsTitle: string;
  noResultsText: string;
  clear: string;
};

type Item = { id: number; category: PortfolioCategory; featured: boolean; search: string; card: ReactNode };

/** Evento próprio: a URL mudou por este componente (o `replaceState` não dispara `popstate`). */
const URL_EVENT = "nos:portfolio-url";
/** Espera depois da última tecla antes de escrever a busca na URL (navegadores limitam chamadas ao histórico). */
const URL_DELAY = 300;

function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}
const readSearch = () => window.location.search;
const readSearchOnServer = () => "";
const subscribeNever = () => () => {};

/**
 * Pesquisa + filtros por categoria do portfólio, no navegador e sem recarregar. A página é estática: o servidor
 * manda TODOS os cartões e este componente só esconde os que não combinam.
 *
 * O estado vive na URL (`?categoria=fotografia&q=marca`), para o link poder ser copiado e o "voltar" funcionar.
 * A URL é lida com `useSyncExternalStore` (no servidor e na hidratação vale "sem filtro", igual ao HTML estático)
 * em vez de `useSearchParams`, que tiraria a grade do HTML pré-renderizado; e é escrita com
 * `history.replaceState`, que o roteador do Next acompanha sem buscar nada no servidor.
 * Sem JavaScript a barra não aparece e a grade mostra tudo.
 */
export function PortfolioFilter({ items, options, labels }: { items: Item[]; options: PortfolioCategoryOption[]; labels: PortfolioFilterLabels }) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const urlSearch = useSyncExternalStore(subscribeToUrl, readSearch, readSearchOnServer);
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false);
  const fromUrl = parsePortfolioFilter(urlSearch, options.map((option) => option.value));
  // texto que a pessoa está digitando: vale na hora; a URL acompanha logo depois
  const [draft, setDraft] = useState<string | null>(null);
  const filter: FilterState = { category: fromUrl.category, q: draft ?? fromUrl.q };

  // "voltar"/"avançar" do navegador: a URL manda de novo
  useEffect(() => {
    const drop = () => {
      clearTimeout(timer.current);
      setDraft(null);
    };
    window.addEventListener("popstate", drop);
    return () => {
      window.removeEventListener("popstate", drop);
      clearTimeout(timer.current);
    };
  }, []);

  function writeUrl(next: FilterState) {
    const query = portfolioFilterQuery(next);
    if (query === window.location.search) return;
    window.history.replaceState(null, "", `${window.location.pathname}${query}`);
    window.dispatchEvent(new Event(URL_EVENT));
  }

  function setCategory(category: PortfolioCategory | null) {
    clearTimeout(timer.current);
    writeUrl({ category, q: filter.q });
  }

  function setQuery(q: string) {
    setDraft(q);
    clearTimeout(timer.current);
    // a categoria é lida na hora de escrever: pode ter mudado enquanto a pessoa digitava
    timer.current = setTimeout(() => writeUrl({ category: parsePortfolioFilter(window.location.search).category, q }), URL_DELAY);
  }

  function clear() {
    clearTimeout(timer.current);
    setDraft(null);
    writeUrl({ category: null, q: "" });
    inputRef.current?.focus();
  }

  const matchingSearch = filterPortfolio(items, { category: null, q: filter.q });
  const visible = new Set(filterPortfolio(items, filter).map((item) => item.id));
  const count = (category: PortfolioCategory) => matchingSearch.filter((item) => item.category === category).length;
  const active = Boolean(filter.category || filter.q.trim());
  const summary = active ? `${visible.size} de ${items.length} ${items.length === 1 ? "projeto" : "projetos"}` : `${items.length} ${items.length === 1 ? "projeto" : "projetos"}`;
  const chips: { value: PortfolioCategory | null; label: string; count: number }[] = [
    { value: null, label: labels.all, count: matchingSearch.length },
    ...options.map((option) => ({ value: option.value, label: option.label, count: count(option.value) })),
  ];

  return (
    <div className="portfolio" data-filtered={active || undefined}>
      <noscript>
        <style>{".portfolio__bar{display:none}"}</style>
      </noscript>
      <div className="portfolio__bar">
        <div className="portfolio__search">
          <label htmlFor={`${uid}-q`} className="s-meta portfolio__search-label">
            {labels.search}
          </label>
          <div className="portfolio__search-field">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M15.5 15.5 21 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            </svg>
            <input
              ref={inputRef}
              id={`${uid}-q`}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={PORTFOLIO_SEARCH_MAX}
              placeholder={labels.placeholder}
              value={filter.q}
              disabled={!hydrated}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && filter.q) {
                  event.preventDefault();
                  setQuery("");
                }
              }}
            />
          </div>
          <p className="s-meta portfolio__count" role="status" aria-live="polite">
            {hydrated ? summary : ""}
          </p>
        </div>
        {options.length > 1 ? (
          <div className="portfolio__chips" role="group" aria-label="Filtrar por categoria">
            {chips.map((chip) => {
              const pressed = chip.value === filter.category;
              return (
                <button
                  key={chip.value ?? "todas"}
                  type="button"
                  className={cn("portfolio__chip", pressed && "is-active")}
                  aria-pressed={pressed}
                  data-empty={chip.count === 0 || undefined}
                  disabled={!hydrated}
                  onClick={() => setCategory(chip.value)}
                >
                  <span>{chip.label}</span>
                  <small>
                    <span className="sr-only">: </span>
                    {chip.count}
                    <span className="sr-only">{chip.count === 1 ? " projeto" : " projetos"}</span>
                  </small>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <ul className="s-works portfolio__grid">
        {items.map((item) => (
          <li key={item.id} className="s-work portfolio__item" data-category={item.category} data-featured={item.featured || undefined} hidden={!visible.has(item.id)}>
            {item.card}
          </li>
        ))}
      </ul>

      {visible.size === 0 ? (
        <div className="portfolio__empty">
          <p className="s-h3">{labels.noResultsTitle}</p>
          {labels.noResultsText ? <p className="s-lead">{labels.noResultsText}</p> : null}
          {labels.clear ? (
            <button type="button" className="s-btn s-btn--sm" onClick={clear}>
              <span>{labels.clear}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
