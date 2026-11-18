"use client";

import { X } from "lucide-react";
import { AlertDialog as RadixAlertDialog, Dialog as RadixDialog } from "radix-ui";
import { createContext, use, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "./button";
import { ActionForm, SubmitButton, type FormAction } from "./form";

const DialogCloseContext = createContext<(() => void) | null>(null);

/** Fecha o `<Dialog>`/`<Drawer>` mais próximo. Ex.: `<ActionForm onSuccess={useDialogClose()}>`. */
export function useDialogClose(): () => void {
  return use(DialogCloseContext) ?? (() => {});
}
export { DialogCloseContext };

const SIZES = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" } as const;

export type DialogProps = {
  /** Elemento que abre o diálogo (um `<Button>`). Dispensável no modo controlado. */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Rodapé fixo (botões). Para fechar: `<DialogClose><Button variant="secondary">Cancelar</Button></DialogClose>`. */
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** Modo controlado (opcional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Janela modal acessível (Radix): foco preso, Esc fecha, foco volta ao gatilho.
 * No celular ocupa a largura toda, ancorada embaixo.
 */
export function Dialog({ trigger, title, description, children, footer, size = "md", open, onOpenChange }: DialogProps) {
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
        <RadixDialog.Overlay className="sobreposicao-fundo bg-grafite/50 fixed inset-0 z-50" />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "dialogo-entrada shadow-flutuante fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] w-full flex-col rounded-t-cartao bg-white outline-none",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-cartao",
            SIZES[size],
          )}
        >
          <div className="flex items-start gap-3 px-5 pt-5 pb-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <RadixDialog.Title className="text-grafite text-lg leading-snug font-bold">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="text-cinza mt-1 text-sm leading-relaxed">{description}</RadixDialog.Description> : null}
            </div>
            <RadixDialog.Close asChild>
              <button type="button" aria-label="Fechar" className="btn btn-ghost btn-icon text-cinza -mt-1.5 -mr-2 shrink-0">
                <X aria-hidden="true" className="size-5" />
              </button>
            </RadixDialog.Close>
          </div>
          <DialogCloseContext value={() => setOpen(false)}>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5 sm:px-6">{children}</div>
            {footer ? (
              <div className="border-areia flex flex-col-reverse gap-2 border-t px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
                {footer}
              </div>
            ) : null}
          </DialogCloseContext>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Envolve um botão para fechar o Dialog/Drawer ao clicar. */
export function DialogClose({ children }: { children: ReactNode }) {
  return <RadixDialog.Close asChild>{children}</RadixDialog.Close>;
}

export type ConfirmDialogProps = {
  /** Elemento que abre a confirmação (ex.: `<Button variant="danger-ghost">Excluir</Button>`). */
  trigger?: ReactNode;
  title: ReactNode;
  /** Explique a consequência ("Esta ação não pode ser desfeita."). */
  description?: ReactNode;
  /** Server Action `(prev, formData) => ActionState`. Se ela fizer `redirect()`, a tela muda sozinha. */
  action: FormAction;
  /** Campos enviados à action (ex.: `hidden={{ id: lead.id }}`). */
  hidden?: Record<string, string | number | null | undefined>;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Cor do botão de confirmar: `danger` (padrão) ou `primary` para confirmações não destrutivas. */
  tone?: Extract<ButtonVariant, "danger" | "primary">;
  /** Conteúdo extra entre a descrição e os botões (pode conter campos, enviados junto). */
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Confirmação de uma ação (normalmente destrutiva) ligada direto a uma Server Action.
 * Fecha ao receber `ok: true`; erro (`ok: false`) aparece dentro do diálogo.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  action,
  hidden,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  children,
  open,
  onOpenChange,
}: ConfirmDialogProps) {
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };
  return (
    <RadixAlertDialog.Root open={isOpen} onOpenChange={setOpen}>
      {trigger ? <RadixAlertDialog.Trigger asChild>{trigger}</RadixAlertDialog.Trigger> : null}
      <RadixAlertDialog.Portal>
        <RadixAlertDialog.Overlay className="sobreposicao-fundo bg-grafite/50 fixed inset-0 z-50" />
        <RadixAlertDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            // texto longo ou tela baixa: como o <Dialog>, nunca passa da altura da tela — rola por dentro
            "dialogo-entrada shadow-flutuante fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-cartao bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-cartao sm:p-6",
          )}
        >
          <RadixAlertDialog.Title className="text-grafite text-lg leading-snug font-bold">{title}</RadixAlertDialog.Title>
          {description ? (
            <RadixAlertDialog.Description asChild>
              <div className="text-cinza mt-2 text-sm leading-relaxed">{description}</div>
            </RadixAlertDialog.Description>
          ) : null}
          <ActionForm action={action} hidden={hidden} onSuccess={() => setOpen(false)} className="mt-4 space-y-4">
            {children}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <RadixAlertDialog.Cancel asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </RadixAlertDialog.Cancel>
              <SubmitButton variant={tone}>{confirmLabel}</SubmitButton>
            </div>
          </ActionForm>
        </RadixAlertDialog.Content>
      </RadixAlertDialog.Portal>
    </RadixAlertDialog.Root>
  );
}
