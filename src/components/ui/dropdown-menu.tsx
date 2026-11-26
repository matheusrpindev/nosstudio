"use client";

import Link from "next/link";
import { DropdownMenu as RadixMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type DropdownMenuProps = {
  /** Botão que abre o menu (ex.: `<IconButton aria-label="Mais ações"><EllipsisVertical /></IconButton>`). */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
};

/** Menu de ações (Radix): setas navegam, Enter seleciona, Esc fecha. */
export function DropdownMenu({ trigger, children, align = "end", side = "bottom" }: DropdownMenuProps) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="flutuante-entrada border-borda shadow-flutuante z-[60] min-w-48 rounded-campo border bg-superficie-alta p-1.5"
        >
          {children}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}

const itemClasses = (tone: "default" | "danger") =>
  cn(
    "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-3 text-sm font-medium outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 [&>svg]:size-[1.125rem] [&>svg]:shrink-0",
    tone === "danger" ? "text-perigo data-[highlighted]:bg-perigo-claro" : "text-texto data-[highlighted]:bg-detalhe-suave data-[highlighted]:text-detalhe",
  );

export type DropdownMenuItemProps = {
  children: ReactNode;
  icon?: ReactNode;
  /** Navega para a rota (vira link). */
  href?: string;
  /** Abre em nova aba (com `href` externo). */
  external?: boolean;
  /** Executa algo no cliente (abrir um ConfirmDialog controlado, copiar texto…). */
  onSelect?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

export function DropdownMenuItem({ children, icon, href, external, onSelect, tone = "default", disabled }: DropdownMenuItemProps) {
  const content = (
    <>
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </>
  );
  if (href) {
    return (
      <RadixMenu.Item asChild disabled={disabled} className={itemClasses(tone)}>
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {content}
          </a>
        ) : (
          <Link href={href}>{content}</Link>
        )}
      </RadixMenu.Item>
    );
  }
  return (
    <RadixMenu.Item disabled={disabled} onSelect={onSelect} className={itemClasses(tone)}>
      {content}
    </RadixMenu.Item>
  );
}

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="bg-borda -mx-1.5 my-1.5 h-px" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="text-texto-suave px-3 pt-1.5 pb-1 text-xs font-semibold tracking-wide uppercase">{children}</RadixMenu.Label>;
}
