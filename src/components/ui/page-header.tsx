import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: ReactNode;
  /** Uma frase curta sob o título. */
  description?: ReactNode;
  /** Botões da página (a ação principal por último/à direita). */
  actions?: ReactNode;
  /** Link "voltar" acima do título (páginas de detalhe/edição). */
  back?: { href: string; label: string };
  /** Etiquetas ao lado do título (ex.: `<StatusBadge />`). */
  badge?: ReactNode;
  className?: string;
};

/** Cabeçalho de toda página do painel: `<h1>`, descrição, voltar e ações. */
export function PageHeader({ title, description, actions, back, badge, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 sm:mb-8", className)}>
      {back ? (
        <Link href={back.href} className="text-texto-suave hover:text-detalhe -ml-1 mb-2 inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-md px-1 text-sm font-semibold">
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-texto text-2xl leading-tight font-extrabold tracking-tight break-words sm:text-[1.75rem]">{title}</h1>
            {badge}
          </div>
          {description ? <p className="text-texto-suave mt-1.5 max-w-2xl text-sm leading-relaxed sm:text-[0.9375rem]">{description}</p> : null}
        </div>
        {/* no celular os botões dividem a largura (ou empilham, se não couberem) */}
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">{actions}</div> : null}
      </div>
    </header>
  );
}
