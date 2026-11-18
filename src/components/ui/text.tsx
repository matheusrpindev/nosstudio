import { cn } from "@/lib/cn";
import { formatDate, formatDateLong, formatDateShort, formatDateTime, formatRelativeDay, todayISO, type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";

type MoneyProps = {
  /** Valor em centavos. `null`/`undefined` mostra o `fallback`. */
  cents: number | null | undefined;
  /** Pinta de verde (positivo) / vermelho (negativo) — para saldos e lançamentos. */
  colored?: boolean;
  fallback?: string;
  className?: string;
};

/** Dinheiro formatado (`R$ 1.234,56`) com algarismos alinhados. Sempre a partir de centavos. */
export function Money({ cents, colored, fallback = "—", className }: MoneyProps) {
  if (cents == null) return <span className={cn("text-cinza", className)}>{fallback}</span>;
  return (
    <span className={cn("whitespace-nowrap tabular-nums", colored && cents > 0 && "text-sucesso", colored && cents < 0 && "text-perigo", className)}>
      {formatBRL(cents)}
    </span>
  );
}

type DateTextProps = {
  /** Data de calendário `YYYY-MM-DD` ou instante (`Date`, colunas `timestamp_ms`). */
  value: ISODate | Date | null | undefined;
  /**
   * `date` 17/11/2026 (padrão) · `long` 17 de novembro de 2026 · `short` 17 nov ·
   * `datetime` 17/11/2026 14:30 (só para `Date`) · `relative` hoje / amanhã / há 2 dias.
   */
  format?: "date" | "long" | "short" | "datetime" | "relative";
  fallback?: string;
  className?: string;
};

/** Data formatada dentro de `<time>`. Instantes são convertidos para o fuso do estúdio. */
export function DateText({ value, format = "date", fallback = "—", className }: DateTextProps) {
  if (!value) return <span className={cn("text-cinza", className)}>{fallback}</span>;
  const iso = value instanceof Date ? todayISO(value) : value;
  let text: string;
  if (format === "datetime" && value instanceof Date) text = formatDateTime(value);
  else if (format === "long") text = formatDateLong(iso);
  else if (format === "short") text = formatDateShort(iso);
  else if (format === "relative") text = formatRelativeDay(iso, todayISO());
  else text = formatDate(iso);
  if (!text) return <span className={cn("text-cinza", className)}>{fallback}</span>;
  return (
    <time dateTime={value instanceof Date ? value.toISOString() : iso} className={cn("whitespace-nowrap", className)}>
      {text}
    </time>
  );
}
