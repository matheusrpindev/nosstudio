import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

type StyleProps = {
  /** `primary` (roxo) é a ação principal da tela; `accent` (lima) só para um destaque pontual. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone à esquerda do texto (ex.: `<Plus />` do lucide-react). O tamanho é ajustado sozinho. */
  icon?: ReactNode;
  /** Ícone à direita do texto. */
  iconRight?: ReactNode;
  /** Ocupa a largura toda (útil em formulários no celular). */
  block?: boolean;
};

/** Classes de um botão — use quando precisar da aparência num elemento próprio (`<summary>`, `<label>`…). */
export function buttonClasses({ variant = "primary", size = "md", block }: Pick<StyleProps, "variant" | "size" | "block"> = {}) {
  return cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", size === "lg" && "btn-lg", block && "w-full");
}

function Content({ icon, iconRight, children }: { icon?: ReactNode; iconRight?: ReactNode; children?: ReactNode }) {
  return (
    <>
      {icon ? <span className="btn-icone" aria-hidden="true">{icon}</span> : null}
      {children}
      {iconRight ? <span className="btn-icone" aria-hidden="true">{iconRight}</span> : null}
    </>
  );
}

export type ButtonProps = StyleProps &
  Omit<ComponentProps<"button">, "children"> & {
    children?: ReactNode;
    /** Mostra o spinner e desabilita o botão. Em formulários com Server Action prefira `<SubmitButton>`. */
    loading?: boolean;
  };

/** Botão de ação. `type="button"` por padrão (não envia formulários sem querer). */
export function Button({ variant, size, icon, iconRight, block, loading, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonClasses({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={loading ? <Spinner label="" /> : icon} iconRight={iconRight}>
        {children}
      </Content>
    </button>
  );
}

export type ButtonLinkProps = StyleProps &
  Omit<ComponentProps<typeof Link>, "children"> & {
    children?: ReactNode;
    /** Abre em nova aba com `rel="noopener noreferrer"` (links externos: WhatsApp, Drive…). */
    external?: boolean;
  };

/**
 * Link com aparência de botão (navegação). Para links externos use `external`; para baixar um arquivo de uma
 * rota (exportações, PDF) passe `download` — vira um link comum, sem prefetch.
 */
export function ButtonLink({ variant, size, icon, iconRight, block, external, className, children, ...rest }: ButtonLinkProps) {
  const classes = cn(buttonClasses({ variant, size, block }), className);
  if (external) {
    const { href, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...anchor } = rest;
    return (
      <a href={typeof href === "string" ? href : "#"} target="_blank" rel="noopener noreferrer" className={classes} {...anchor}>
        <Content icon={icon} iconRight={iconRight}>
          {children}
        </Content>
      </a>
    );
  }
  if (rest.download !== undefined && rest.download !== false) {
    // Download (CSV, JSON, PDF de uma rota do painel): link comum, nunca <Link> — o <Link> faz prefetch e a rota
    // seria chamada só de a página abrir (arquivo gerado à toa e uma linha falsa de "exportou" na auditoria).
    const { href, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...anchor } = rest;
    return (
      <a href={typeof href === "string" ? href : "#"} className={classes} {...anchor}>
        <Content icon={icon} iconRight={iconRight}>
          {children}
        </Content>
      </a>
    );
  }
  return (
    <Link className={classes} {...rest}>
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </Link>
  );
}

export type IconButtonProps = Omit<ComponentProps<"button">, "children" | "aria-label"> & {
  /** Obrigatório: o que o botão faz, para leitores de tela (também vira `title`). */
  "aria-label": string;
  /** O ícone (ex.: `<Trash2 />`). */
  children: ReactNode;
  variant?: ButtonVariant;
  /** `md` = 44px (alvo de toque); `sm` = 36px, só em áreas densas no desktop. */
  size?: "sm" | "md";
  loading?: boolean;
};

/** Botão só com ícone. `aria-label` é obrigatório. */
export function IconButton({ variant = "ghost", size = "md", loading, disabled, className, children, type = "button", title, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      title={title ?? rest["aria-label"]}
      className={cn("btn btn-icon", `btn-${variant}`, size === "sm" && "btn-sm", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className="btn-icone" aria-hidden="true">
        {loading ? <Spinner label="" /> : children}
      </span>
    </button>
  );
}
