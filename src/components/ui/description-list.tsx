import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DescriptionItem = {
  label: string;
  /** Valor. Vazio (`null`, `undefined`, `""`) mostra um traço — ou some, com `hideEmpty`. */
  value: ReactNode;
  /** Ocupa a linha inteira no layout em colunas (textos longos). */
  wide?: boolean;
};

type DescriptionListProps = {
  items: readonly DescriptionItem[];
  /** `rows` (padrão): rótulo à esquerda, valor à direita, uma linha por item. `grid`: blocos em 2 colunas. */
  layout?: "rows" | "grid";
  /** Não renderiza itens sem valor. */
  hideEmpty?: boolean;
  className?: string;
};

const isEmpty = (value: ReactNode) => value === null || value === undefined || value === "" || value === false;

/** Lista de "rótulo: valor" para telas de detalhe (`<dl>` semântico). */
export function DescriptionList({ items, layout = "rows", hideEmpty, className }: DescriptionListProps) {
  const visible = hideEmpty ? items.filter((item) => !isEmpty(item.value)) : items;
  if (visible.length === 0) return null;
  if (layout === "grid") {
    return (
      <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
        {visible.map((item) => (
          <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-2")}>
            <dt className="text-texto-suave text-[0.8125rem] font-semibold">{item.label}</dt>
            <dd className="text-texto mt-0.5 text-[0.9375rem] leading-relaxed break-words">{isEmpty(item.value) ? <span className="text-texto-suave">—</span> : item.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={cn("divide-borda divide-y", className)}>
      {visible.map((item) => (
        <div key={item.label} className="py-2.5 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-texto-suave text-[0.8125rem] font-semibold sm:pt-0.5">{item.label}</dt>
          <dd className="text-texto mt-0.5 min-w-0 text-[0.9375rem] leading-relaxed break-words sm:mt-0">
            {isEmpty(item.value) ? <span className="text-texto-suave">—</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
