import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = {
  children: ReactNode;
  /** Sem padding interno (para listas/tabelas que encostam na borda, ou quando usar CardHeader/CardSection). */
  flush?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  "aria-labelledby"?: string;
};

/** Superfície branca padrão. Com `flush`, componha com `CardHeader` + `CardSection`. */
export function Card({ children, flush, className, as: Tag = "div", ...rest }: CardProps) {
  return (
    <Tag className={cn("card", !flush && "card-pad", className)} {...rest}>
      {children}
    </Tag>
  );
}

type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Ação à direita (link "ver todos", botão pequeno). */
  action?: ReactNode;
  /** Nível do título (padrão h2). */
  as?: "h2" | "h3";
  id?: string;
  className?: string;
};

/** Título de cartão. Dentro de `<Card flush>` ganha padding e linha divisória próprios. */
export function CardHeader({ title, description, action, as: Heading = "h2", id, className }: CardHeaderProps) {
  return (
    <div className={cn("card-cabecalho flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-texto text-base leading-snug font-bold">
          {title}
        </Heading>
        {description ? <p className="text-texto-suave mt-0.5 text-sm leading-relaxed">{description}</p> : null}
      </div>
      {action ? <div className="-my-1 shrink-0">{action}</div> : null}
    </div>
  );
}

/** Seção de um `<Card flush>`: padding padrão e divisória entre seções. */
export function CardSection({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-secao", className)}>{children}</div>;
}

type StatCardProps = {
  label: string;
  /** Número/valor em destaque (já formatado: `formatBRL(...)`, `"03"`…). */
  value: ReactNode;
  /** Linha de apoio abaixo do número. */
  caption?: ReactNode;
  /** Torna o cartão inteiro um link. */
  href?: string;
  icon?: ReactNode;
  /** `lg` (padrão) para contagens curtas ("03"); `md` para valores longos como dinheiro — encolhe com o cartão, sem estourar. */
  size?: "lg" | "md";
  /** `destaque` pinta o cartão de roxo, com número branco (use em no máximo um por tela). */
  tone?: "padrao" | "destaque";
  className?: string;
};

/** Cartão de indicador: rótulo, número grande na cor de destaque (`primaria`: lima no painel), legenda e link opcional. */
export function StatCard({ label, value, caption, href, icon, size = "lg", tone = "padrao", className }: StatCardProps) {
  const highlight = tone === "destaque";
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-semibold", highlight ? "text-lavanda" : "text-texto-suave")}>{label}</p>
        {href ? (
          <ArrowUpRight aria-hidden="true" className={cn("size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5", highlight ? "text-lima" : "text-borda-forte group-hover:text-detalhe")} />
        ) : icon ? (
          <span aria-hidden="true" className={cn("[&>svg]:size-[1.125rem]", highlight ? "text-lima" : "text-detalhe/60")}>
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 leading-none font-extrabold tracking-tight tabular-nums",
          size === "lg" ? "text-[2rem] sm:text-4xl" : "pt-1 text-[clamp(1.125rem,10.5cqi,1.75rem)] sm:pt-1.5",
          highlight ? "text-white" : "text-primaria",
        )}
      >
        {value}
      </p>
      {caption ? <p className={cn("mt-2 text-[0.8125rem] leading-snug", highlight ? "text-lavanda" : "text-texto-suave")}>{caption}</p> : null}
    </>
  );
  const classes = cn(
    "card group @container block min-w-0 p-4 sm:p-5",
    highlight && "bg-roxo border-detalhe-medio",
    href && (highlight ? "hover:bg-roxo-escuro transition-colors" : "hover:border-detalhe/40 transition-colors"),
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
