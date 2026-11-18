/**
 * Botões e links do site público.
 * - Primário: preenchimento lima (a cor-sinal). Secundário: contorno.
 * - As cores se adaptam sozinhas ao fundo: dentro de um bloco com `data-tone="roxo" | "grafite"` o contorno
 *   e o hover invertem. Não é preciso passar "variante escura".
 * - Links internos usam <Link>; externos abrem em nova aba com `rel="noopener noreferrer"`.
 *   Todo `href` passa por `safeHref` — um link inválido vindo do painel simplesmente não renderiza.
 */
import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { safeHref } from "@/lib/format";
import { Icon, type IconName } from "./marks";

type Variant = "primary" | "secondary";

type ButtonLook = {
  variant?: Variant;
  /** Ícone à direita. `null` para nenhum. Padrão: seta. */
  icon?: IconName | null;
  size?: "md" | "sm";
  /** Ocupa toda a largura do contêiner. */
  block?: boolean;
};

function buttonClass({ variant = "primary", size = "md", block }: ButtonLook, className?: string) {
  return cn("s-btn", variant === "primary" && "s-btn--primary", size === "sm" && "s-btn--sm", block && "s-btn--block", className);
}

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

/** Link "inteligente": interno → <Link>, externo → <a target="_blank">. Devolve `null` se o href for inválido. */
export function SmartLink({ href, children, ...rest }: AnchorProps & { href: string | null | undefined; children: ReactNode }) {
  const safe = safeHref(href);
  if (!safe) return null;
  if (/^https?:/i.test(safe)) {
    return (
      <a href={safe} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={safe} {...rest}>
      {children}
    </Link>
  );
}

/** Botão em forma de link (CTA de navegação). */
export function SiteButtonLink({
  href,
  variant,
  icon = "arrow",
  size,
  block,
  className,
  children,
  ...rest
}: ButtonLook & AnchorProps & { href: string | null | undefined; children: ReactNode }) {
  return (
    <SmartLink href={href} className={buttonClass({ variant, size, block }, className)} {...rest}>
      <span>{children}</span>
      {icon ? <Icon name={icon} /> : null}
    </SmartLink>
  );
}

/** Botão de verdade (<button>): envio de formulário e ações na página. */
export function SiteButton({
  variant,
  icon = "arrow",
  size,
  block,
  className,
  children,
  type = "button",
  ...rest
}: ButtonLook & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass({ variant, size, block }, className)} {...rest}>
      <span>{children}</span>
      {icon ? <Icon name={icon} /> : null}
    </button>
  );
}

/** Link de texto sublinhado com seta ("Conheça todos os serviços →"). */
export function SiteLink({
  href,
  icon = "arrow",
  className,
  children,
  ...rest
}: AnchorProps & { href: string | null | undefined; icon?: IconName | null; children: ReactNode }) {
  return (
    <SmartLink href={href} className={cn("s-link", className)} {...rest}>
      <span>{children}</span>
      {icon ? <Icon name={icon} /> : null}
    </SmartLink>
  );
}
