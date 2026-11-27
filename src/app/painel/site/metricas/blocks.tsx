import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatChange, formatCount, formatShare, relativeChange } from "@/lib/metrics/report";

/**
 * Peças da tela de métricas (Server Components, só tokens semânticos do tema do painel).
 */

// ------------------------------------------------------------------ indicador
type KpiProps = {
  label: string;
  value: string;
  /** Explicação curta do que o número conta. */
  hint?: ReactNode;
  /** Valores para a comparação com o período anterior. Sem `previous`, a linha de variação não aparece. */
  current?: number;
  previous?: number | null;
  /** Como mostrar o valor do período anterior ("120", "2,4%"). */
  previousLabel?: string;
  className?: string;
};

/** Cartão de indicador: rótulo, número e variação contra o período anterior (ícone + sinal + texto, nunca só cor). */
export function Kpi({ label, value, hint, current, previous, previousLabel, className }: KpiProps) {
  const change = current !== undefined && previous !== null && previous !== undefined ? relativeChange(current, previous) : null;
  const direction = change === null ? null : Math.round(change * 100) === 0 ? "igual" : change > 0 ? "subiu" : "caiu";
  const Icon = direction === "subiu" ? ArrowUpRight : direction === "caiu" ? ArrowDownRight : Minus;
  return (
    <div className={cn("card @container min-w-0 p-4 sm:p-5", className)}>
      <p className="text-texto-suave text-sm font-semibold">{label}</p>
      <p className="text-primaria mt-2 text-[clamp(1.5rem,14cqi,2rem)] leading-none font-extrabold tracking-tight">{value}</p>
      {previous !== undefined ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.8125rem] leading-snug">
          {change !== null && direction ? (
            <>
              <span className={cn("inline-flex items-center gap-0.5 font-bold", direction === "subiu" ? "text-sucesso" : direction === "caiu" ? "text-perigo" : "text-texto-suave")}>
                <Icon aria-hidden="true" className="size-4" />
                <span className="sr-only">{direction === "subiu" ? "Subiu " : direction === "caiu" ? "Caiu " : "Sem mudança: "}</span>
                {formatChange(change)}
              </span>
              <span className="text-texto-suave">antes: {previousLabel ?? formatCount(previous ?? 0)}</span>
            </>
          ) : (
            <span className="text-texto-suave">Sem período anterior para comparar</span>
          )}
        </p>
      ) : null}
      {hint ? <p className="text-texto-suave mt-1.5 text-[0.8125rem] leading-snug">{hint}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------ lista com barras
export type BarItem = { key: string; label: ReactNode; value: number; share?: number; note?: ReactNode };

/**
 * Lista ordenada com uma barra fina por linha (comprimento = valor em relação ao maior da lista). O valor e a
 * participação ficam escritos em cada linha: a barra é apoio visual, não a única leitura.
 */
export function BarList({ items, unit, caption, mono }: { items: BarItem[]; unit: [singular: string, plural: string]; caption: string; mono?: boolean }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ol className="space-y-3.5" aria-label={caption}>
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cn("text-texto min-w-0 text-sm font-semibold break-words", mono && "font-mono text-[0.8125rem] font-medium")}>{item.label}</span>
            <span className="text-texto shrink-0 text-sm font-bold tabular-nums">
              {formatCount(item.value)}
              <span className="sr-only"> {item.value === 1 ? unit[0] : unit[1]}</span>
              {item.share !== undefined ? <span className="text-texto-suave ml-2 inline-block min-w-[2.75rem] text-right font-medium">{formatShare(item.share)}</span> : null}
            </span>
          </div>
          <div aria-hidden="true" className="bg-superficie-alta mt-1.5 h-2 overflow-hidden rounded-full">
            <div className="bg-detalhe h-full rounded-full" style={{ width: `${Math.max(1.5, (item.value / max) * 100)}%` }} />
          </div>
          {item.note ? <p className="text-texto-suave mt-1 text-[0.8125rem] leading-snug">{item.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/** Texto de "nada aqui ainda" dentro de um cartão. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-texto-suave py-4 text-sm leading-relaxed">{children}</p>;
}
