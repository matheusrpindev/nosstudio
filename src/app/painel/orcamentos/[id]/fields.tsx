"use client";

/** Campos controlados pequenos usados só no editor de propostas. */
import { useState, type ComponentProps, type ReactNode } from "react";
import { useFieldContext } from "@/components/ui/form";
import { cn } from "@/lib/cn";

/** "12,5" → 12.5 · "" → 0. */
function parseDecimal(text: string): number {
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}
const formatDecimal = (value: number) => (Number.isFinite(value) ? String(value).replace(".", ",") : "0");

type DecimalInputProps = Omit<ComponentProps<"input">, "value" | "defaultValue" | "onChange" | "type"> & {
  value: number;
  onValueChange: (value: number) => void;
  /** Teto (ex.: 100 para percentuais). */
  max?: number;
  /** Casas decimais aceitas (padrão 2). */
  decimals?: number;
  /** Texto fixo à direita (ex.: "%"). */
  suffix?: string;
  wrapperClassName?: string;
};

/**
 * Número decimal com vírgula (quantidade, percentual), controlado por `value` numérico.
 * O texto digitado fica em estado próprio ("1," continua na tela enquanto vale 1).
 */
export function DecimalInput({ value, onValueChange, max, decimals = 2, suffix, className, wrapperClassName, ...rest }: DecimalInputProps) {
  const field = useFieldContext();
  const [text, setText] = useState(() => formatDecimal(value));
  // o valor mudou por fora (recarregou do servidor): o texto acompanha
  if (parseDecimal(text) !== value) setText(formatDecimal(value));

  return (
    <div className={cn("relative", wrapperClassName)}>
      <input
        id={field?.id}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn("input tabular-nums", suffix && "pr-9", className)}
        value={text}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          let next = event.target.value.replace(/[^\d.,]/g, "").replace(/\./g, ",");
          const comma = next.indexOf(",");
          if (comma >= 0) next = `${next.slice(0, comma)},${next.slice(comma + 1).replace(/,/g, "").slice(0, decimals)}`;
          let parsed = parseDecimal(next);
          if (max !== undefined && parsed > max) {
            parsed = max;
            next = formatDecimal(max);
          }
          setText(next);
          onValueChange(parsed);
        }}
      />
      {suffix ? (
        <span aria-hidden="true" className="text-texto-suave pointer-events-none absolute inset-y-0 right-3 flex items-center text-base">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/** Rótulo compacto para campos dentro de linhas de lista (itens, custos, parcelas). */
export function Mini({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-texto-suave mb-1 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** Linha "rótulo … valor" dos resumos de cálculo. */
export function SumRow({ label, value, hint, strong, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <dt className={cn("min-w-0 text-sm", strong ? "text-texto font-bold" : "text-texto-suave")}>
        {label}
        {hint ? <span className="text-texto-suave block text-xs font-normal">{hint}</span> : null}
      </dt>
      <dd className={cn("shrink-0 text-right tabular-nums", strong ? "text-texto text-lg font-extrabold" : "text-texto text-[0.9375rem] font-semibold")}>{value}</dd>
    </div>
  );
}
