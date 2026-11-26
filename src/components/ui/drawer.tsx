"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DialogCloseContext } from "./dialog";

const SIDES = {
  right: "gaveta-direita inset-y-0 right-0 h-full w-full max-w-md sm:rounded-l-cartao",
  left: "gaveta-esquerda inset-y-0 left-0 h-full w-[min(20rem,88vw)]",
  bottom: "gaveta-baixo inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-cartao",
} as const;

export type DrawerProps = {
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Rodapé fixo (botões). */
  footer?: ReactNode;
  /** De onde a gaveta entra: `right` (padrão, edição/detalhe), `bottom` (menus no celular), `left`. */
  side?: keyof typeof SIDES;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Classes do painel (ex.: `bg-menu` no menu do painel). */
  className?: string;
  /** Sem cabeçalho nem padding: o conteúdo controla o próprio layout (o título continua para leitores de tela). */
  hideHeader?: boolean;
};

/** Gaveta lateral/inferior (Sheet) para formulários rápidos e detalhes sem sair da lista. Esc fecha. */
export function Drawer({ trigger, title, description, children, footer, side = "right", open, onOpenChange, className, hideHeader }: DrawerProps) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={setOpen}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="sobreposicao-fundo bg-veu fixed inset-0 z-50" />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn("shadow-flutuante fixed z-50 flex flex-col bg-superficie outline-none", SIDES[side], className)}
        >
          {hideHeader ? (
            <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          ) : (
            <div className="border-borda flex items-start gap-3 border-b px-5 py-4">
              <div className="min-w-0 flex-1">
                <RadixDialog.Title className="text-texto text-lg leading-snug font-bold">{title}</RadixDialog.Title>
                {description ? <RadixDialog.Description className="text-texto-suave mt-1 text-sm leading-relaxed">{description}</RadixDialog.Description> : null}
              </div>
              <RadixDialog.Close asChild>
                <button type="button" aria-label="Fechar" className="btn btn-ghost btn-icon text-texto-suave -my-1.5 -mr-2 shrink-0">
                  <X aria-hidden="true" className="size-5" />
                </button>
              </RadixDialog.Close>
            </div>
          )}
          <DialogCloseContext value={() => setOpen(false)}>
            {hideHeader ? (
              // sem cabeçalho, quem usa controla o layout interno (rolagem, padding)
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            ) : (
              <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5", !footer && "pb-[calc(1.25rem+env(safe-area-inset-bottom))]")}>{children}</div>
            )}
            {footer ? (
              <div className="border-borda flex flex-col-reverse gap-2 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">{footer}</div>
            ) : null}
          </DialogCloseContext>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Mesmo componente; "Sheet" é o nome usado em outros kits. */
export const Sheet = Drawer;
