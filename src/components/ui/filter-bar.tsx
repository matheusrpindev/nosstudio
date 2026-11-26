"use client";

import { Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { normalizeOptions, type SelectOptions } from "./input";

export type FilterSelect = {
  /** Nome do parâmetro na URL (ex.: `status`). */
  name: string;
  /** Rótulo acessível (ex.: "Status"). */
  label: string;
  /** Lista `{ value, label }` ou um mapa de rótulos de `src/lib/domain.ts`. */
  options: SelectOptions;
  /** Texto da opção "sem filtro" (ex.: "Todos os status"). */
  allLabel: string;
};

export type FilterBarProps = {
  /** Campo de busca (`?q=`). Passe `false` para não ter busca. */
  search?: { name?: string; placeholder?: string; label?: string } | false;
  /** Filtros por select; aplicam ao mudar. */
  filters?: readonly FilterSelect[];
  /** Parâmetros da URL a preservar ao filtrar (ex.: `["aba"]`). A paginação sempre volta para a página 1. */
  preserve?: readonly string[];
  /** Controles extras (precisam ter `name`; entram na URL). */
  children?: ReactNode;
  className?: string;
};

/**
 * Barra de filtros de uma lista: um `<form method="get">` que escreve os filtros na URL (`searchParams`).
 * A página lê `await searchParams`, valida e consulta — o estado dos filtros vive só na URL (dá para compartilhar e voltar).
 */
export function FilterBar({ search = {}, filters = [], preserve = [], children, className }: FilterBarProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const searchName = search ? (search.name ?? "q") : "";
  const searchValue = searchName ? (params.get(searchName) ?? "") : "";
  const formRef = useRef<HTMLFormElement>(null);
  const names = [searchName, ...filters.map((filter) => filter.name)].filter(Boolean);
  const current = names.map((name) => params.get(name) ?? "").join("\u0000");

  // Os campos não são controlados (o valor "de verdade" é a URL). Se a URL mudar por fora — voltar do navegador,
  // "Limpar filtros" — os campos acompanham, sem remontar (ninguém perde o foco).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const values = current.split("\u0000");
    names.forEach((name, index) => {
      const control = form.elements.namedItem(name);
      if ((control instanceof HTMLInputElement || control instanceof HTMLSelectElement) && control.value !== values[index]) {
        control.value = values[index];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `current` resume os valores de todos os campos
  }, [current]);

  const active = Boolean(searchValue) || filters.some((filter) => params.get(filter.name));

  return (
    <Form ref={formRef} action={pathname} role="search" aria-label="Filtros" className={cn("mb-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center", className)}>
      {preserve.map((name) => {
        const value = params.get(name);
        return value ? <input key={name} type="hidden" name={name} value={value} /> : null;
      })}
      {search ? (
        <div className="relative min-w-0 md:max-w-sm md:flex-1 md:basis-64">
          <input
            type="search"
            name={searchName}
            defaultValue={searchValue}
            aria-label={search.label ?? "Buscar"}
            placeholder={search.placeholder ?? "Buscar…"}
            enterKeyHint="search"
            className="input pr-12"
          />
          <button type="submit" aria-label="Buscar" title="Buscar" className="text-texto-suave hover:text-detalhe absolute inset-y-0 right-0 inline-flex w-11 cursor-pointer items-center justify-center rounded-r-campo">
            <Search aria-hidden="true" className="size-[1.125rem]" />
          </button>
        </div>
      ) : null}
      {filters.length > 0 ? (
        <div className={cn("grid gap-2 md:flex md:flex-wrap", filters.length > 1 && "grid-cols-2")}>
          {filters.map((filter) => (
            <select
              key={filter.name}
              name={filter.name}
              aria-label={filter.label}
              defaultValue={params.get(filter.name) ?? ""}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className={cn("input md:w-auto md:max-w-56", params.get(filter.name) && "border-detalhe text-detalhe font-semibold")}
            >
              <option value="">{filter.allLabel}</option>
              {normalizeOptions(filter.options).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      ) : null}
      {children}
      {active ? (
        <Link href={pathname} className="btn btn-ghost btn-sm self-start md:self-auto">
          <X aria-hidden="true" className="size-4" />
          Limpar filtros
        </Link>
      ) : null}
    </Form>
  );
}
