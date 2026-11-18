"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export type PaginationProps = {
  /** Página atual (começa em 1). */
  page: number;
  /** Itens por página. */
  pageSize: number;
  /** Total de itens (de todas as páginas). */
  total: number;
  /** Nome do parâmetro na URL (padrão `pagina`). */
  param?: string;
  /** Substantivo para o resumo: "leads" → "1–20 de 53 leads". */
  noun?: string;
  className?: string;
};

/**
 * Paginação por links (`?pagina=2`), preservando os outros filtros da URL.
 * Na página, leia a página atual com `parsePage(sp.pagina)` de `@/components/ui/search-params`.
 */
export function Pagination({ page, pageSize, total, param = "pagina", noun = "itens", className }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams);
    if (target <= 1) params.delete(param);
    else params.set(param, String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const summary = (
    <p className="text-cinza text-sm tabular-nums">
      {to >= from ? (
        <>
          <span className="text-grafite font-semibold">
            {from}–{to}
          </span>{" "}
          de {total} {noun}
        </>
      ) : (
        <>
          {total} {noun}
        </>
      )}
    </p>
  );
  if (pageCount === 1) return <div className={cn("mt-4 px-1", className)}>{summary}</div>;

  const step = (target: number, label: string, icon: React.ReactNode, disabled: boolean) =>
    disabled ? (
      <span aria-disabled="true" className="btn btn-secondary btn-icon opacity-45">
        {icon}
        <span className="sr-only">{label} (indisponível)</span>
      </span>
    ) : (
      <Link href={hrefFor(target)} aria-label={label} className="btn btn-secondary btn-icon" scroll>
        {icon}
      </Link>
    );

  return (
    <nav aria-label="Paginação" className={cn("mt-4 flex items-center justify-between gap-3 px-1", className)}>
      {summary}
      <div className="flex items-center gap-2">
        <span className="text-cinza text-sm tabular-nums max-sm:sr-only">
          Página {page} de {pageCount}
        </span>
        {step(page - 1, "Página anterior", <ChevronLeft aria-hidden="true" className="size-5" />, page <= 1)}
        {step(page + 1, "Próxima página", <ChevronRight aria-hidden="true" className="size-5" />, page >= pageCount)}
      </div>
    </nav>
  );
}
