import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "sucesso" | "alerta" | "perigo";

const TONES: Record<AlertTone, { box: string; icon: typeof Info; iconColor: string }> = {
  info: { box: "border-lavanda bg-lavanda-claro", icon: Info, iconColor: "text-roxo" },
  sucesso: { box: "border-sucesso/25 bg-sucesso-claro", icon: CircleCheck, iconColor: "text-sucesso" },
  alerta: { box: "border-alerta/25 bg-alerta-claro", icon: TriangleAlert, iconColor: "text-alerta" },
  perigo: { box: "border-perigo/25 bg-perigo-claro", icon: CircleAlert, iconColor: "text-perigo" },
};

type AlertProps = {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Botões/links à direita (ou abaixo, no celular). */
  action?: ReactNode;
  /**
   * `role` ARIA: use `"alert"` para erros que acabaram de acontecer (anunciado na hora) e `"status"` para
   * confirmações. Sem `role`, é só um bloco de destaque estático.
   */
  role?: "alert" | "status";
  className?: string;
  id?: string;
};

/** Bloco de aviso dentro da página (informação, sucesso, atenção, erro). Para avisos passageiros use `toast()`. */
export function Alert({ tone = "info", title, children, action, role, className, id }: AlertProps) {
  const style = TONES[tone];
  const Icon = style.icon;
  return (
    <div id={id} role={role} className={cn("text-grafite flex items-start gap-3 rounded-campo border px-4 py-3 text-sm", style.box, className)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", style.iconColor)} />
      <div className="min-w-0 flex-1 sm:flex sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1 leading-relaxed">
          {title ? <p className="font-bold">{title}</p> : null}
          {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
        </div>
        {action ? <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">{action}</div> : null}
      </div>
    </div>
  );
}

/** Sinônimo de `Alert` para blocos de destaque estáticos ("dica", "atenção"). */
export const Callout = Alert;
