import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  /** Ícone do lucide-react (ex.: `<Inbox />`). */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Botão/link da ação principal (ex.: "Cadastrar lead"). */
  action?: ReactNode;
  /** `card` (padrão) desenha o cartão tracejado; `plain` para usar dentro de um Card existente. */
  variant?: "card" | "plain";
  className?: string;
};

/** Estado vazio de listas e seções: diz o que falta e oferece o próximo passo. */
export function EmptyState({ icon, title, description, action, variant = "card", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-10 text-center",
        variant === "card" && "border-areia-escuro rounded-cartao border border-dashed bg-white/60",
        className,
      )}
    >
      {icon ? (
        <div aria-hidden="true" className="bg-lavanda-claro text-roxo mb-4 flex size-12 items-center justify-center rounded-full [&>svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="text-grafite text-base font-bold">{title}</p>
      {description ? <div className="text-cinza mt-1.5 max-w-md text-sm leading-relaxed">{description}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
