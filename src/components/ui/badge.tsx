import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "roxo" | "lima" | "sucesso" | "alerta" | "perigo";

type BadgeProps = {
  tone?: BadgeTone;
  /** Bolinha colorida antes do texto (reforça o status sem depender só da cor de fundo). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
};

/** Etiqueta pequena. Tons: neutral, roxo, lima, sucesso, alerta, perigo. */
export function Badge({ tone = "neutral", dot, children, className }: BadgeProps) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)}>
      {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

type StatusBadgeProps<T extends string> = {
  /** Valor do enum (ex.: `lead.status`). */
  value: T;
  /** Mapa de rótulos de `src/lib/domain.ts` (ex.: `LEAD_STATUS_LABELS`). */
  labels: Record<T, string>;
  /** Tom por valor. O que faltar cai em `neutral`. */
  tones?: Partial<Record<T, BadgeTone>>;
  dot?: boolean;
  className?: string;
};

/**
 * Status de um registro: valor do enum → rótulo pt-BR + tom.
 * Defina o mapa de tons UMA vez por módulo (ex.: `LEAD_STATUS_TONES` em `src/app/painel/leads/ui.ts`).
 */
export function StatusBadge<T extends string>({ value, labels, tones, dot = true, className }: StatusBadgeProps<T>) {
  return (
    <Badge tone={tones?.[value] ?? "neutral"} dot={dot} className={className}>
      {labels[value] ?? value}
    </Badge>
  );
}
