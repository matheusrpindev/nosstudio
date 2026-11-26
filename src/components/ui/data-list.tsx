import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DataListColumn<T> = {
  /** Identificador único da coluna. */
  key: string;
  /** Cabeçalho da tabela (e rótulo do valor no cartão do celular). */
  header: string;
  /** Conteúdo da célula. */
  cell: (row: T) => ReactNode;
  /** Coluna principal: vira o título do cartão no celular e carrega o link da linha. Marque exatamente uma. */
  primary?: boolean;
  align?: "left" | "right";
  /** Some no celular (dado secundário). */
  hideOnMobile?: boolean;
  /** No celular, mostra só o valor, sem o rótulo à esquerda (bom para badges). */
  hideLabelOnMobile?: boolean;
  /** A célula tem botões/links próprios: fica clicável por cima do link da linha. */
  interactive?: boolean;
  /** Classes da célula (largura, `whitespace-nowrap`…). */
  className?: string;
};

export type DataListProps<T> = {
  columns: readonly DataListColumn<T>[];
  rows: readonly T[];
  /** Chave estável da linha (normalmente o id). */
  rowKey: (row: T) => string | number;
  /** Destino ao clicar na linha (o link fica na coluna `primary`; a linha inteira é clicável). */
  href?: (row: T) => string;
  /** Linhas em destaque (ex.: não lidas): fundo `detalhe-suave` e marcador na cor de destaque. */
  highlight?: (row: T) => boolean;
  /** Texto para leitores de tela quando há linhas em destaque (ex.: "Não lido"). */
  highlightLabel?: string;
  /** O que mostrar sem linhas (normalmente um `<EmptyState variant="plain" />`). */
  empty?: ReactNode;
  /** Nome da tabela para leitores de tela. */
  caption: string;
  className?: string;
};

/**
 * Lista de registros: tabela no desktop (≥ 768px) que vira lista de cartões no celular — mesmo HTML, sem JavaScript.
 * É um Server Component: `cell`, `href` e `highlight` são funções comuns chamadas no servidor.
 */
export function DataList<T>({ columns, rows, rowKey, href, highlight, highlightLabel = "Destaque", empty, caption, className }: DataListProps<T>) {
  if (rows.length === 0) {
    return <div className={cn("card", className)}>{empty ?? <p className="text-texto-suave px-6 py-10 text-center text-sm">Nada por aqui ainda.</p>}</div>;
  }
  return (
    <div className={cn("card overflow-hidden", className)}>
      <table role="table" className="w-full border-collapse text-left text-sm max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup" className="max-md:sr-only">
          <tr role="row" className="border-borda border-b">
            {columns.map((column) => (
              <th
                key={column.key}
                role="columnheader"
                scope="col"
                className={cn("text-texto-suave px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap uppercase first:pl-5 last:pr-5", column.align === "right" && "text-right")}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-borda divide-y max-md:block">
          {rows.map((row) => {
            const marked = highlight?.(row) ?? false;
            const link = href?.(row);
            return (
              <tr
                key={rowKey(row)}
                role="row"
                data-destaque={marked || undefined}
                className={cn(
                  "relative max-md:flex max-md:flex-col max-md:gap-1 max-md:px-4 max-md:py-3.5",
                  link && "hover:bg-detalhe-suave/50 has-[a.linha-link:focus-visible]:bg-detalhe-suave/60 transition-colors",
                  marked && "bg-detalhe-suave/45",
                )}
              >
                {columns.map((column) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.key}
                      role="cell"
                      data-label={column.primary || column.hideLabelOnMobile ? undefined : column.header}
                      className={cn(
                        "align-middle md:px-4 md:py-3 md:first:pl-5 md:last:pr-5",
                        column.primary
                          ? "text-texto max-md:order-first max-md:pr-2 max-md:text-[0.9375rem]"
                          : "text-texto/90 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:text-right",
                        !column.primary &&
                          "max-md:before:text-texto-suave max-md:before:shrink-0 max-md:before:text-left max-md:before:text-[0.8125rem] max-md:before:font-medium max-md:before:content-[attr(data-label)]",
                        column.primary && (marked ? "font-bold" : "font-semibold"),
                        column.align === "right" && "md:text-right",
                        column.hideOnMobile && "max-md:hidden",
                        column.hideLabelOnMobile && "max-md:justify-start max-md:text-left",
                        column.interactive && "relative z-[1]",
                        column.className,
                      )}
                    >
                      {column.primary ? (
                        <span className="flex items-center gap-2.5">
                          {marked ? (
                            <span className="bg-primaria size-2 shrink-0 rounded-full">
                              <span className="sr-only">{highlightLabel}: </span>
                            </span>
                          ) : null}
                          {link ? (
                            <Link href={link} className="linha-link min-w-0 outline-none after:absolute after:inset-0 after:content-['']">
                              {content}
                            </Link>
                          ) : (
                            <span className="min-w-0">{content}</span>
                          )}
                        </span>
                      ) : (
                        <span className="min-w-0">{content}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
