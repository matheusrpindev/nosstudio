import { cn } from "@/lib/cn";

type SpinnerProps = {
  /** Texto para leitores de tela. Passe `""` quando já houver um rótulo visível ao lado. */
  label?: string;
  className?: string;
};

/** Indicador de carregamento. Herda a cor do texto (`currentColor`); tamanho via className (`size-4` padrão). */
export function Spinner({ label = "Carregando…", className }: SpinnerProps) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn("size-4 shrink-0 animate-spin motion-reduce:animate-none", className)}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
