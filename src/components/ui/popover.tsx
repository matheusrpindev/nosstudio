"use client";

import { Popover as RadixPopover } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PopoverProps = {
  /** Botão que abre o balão. */
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  /** Rótulo para leitores de tela quando o conteúdo não tem título próprio. */
  "aria-label"?: string;
  className?: string;
};

/** Balão ancorado a um botão, para conteúdo interativo curto (filtros extras, ajuda, mini-formulário). Esc fecha. */
export function Popover({ trigger, children, align = "start", side = "bottom", className, ...rest }: PopoverProps) {
  return (
    <RadixPopover.Root>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={12}
          aria-label={rest["aria-label"]}
          className={cn(
            "flutuante-entrada border-borda shadow-flutuante text-texto z-[60] w-72 max-w-[calc(100vw-1.5rem)] rounded-cartao border bg-superficie-alta p-4 text-sm outline-none",
            className,
          )}
        >
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

/** Envolve um botão para fechar o Popover ao clicar. */
export function PopoverClose({ children }: { children: ReactNode }) {
  return <RadixPopover.Close asChild>{children}</RadixPopover.Close>;
}
