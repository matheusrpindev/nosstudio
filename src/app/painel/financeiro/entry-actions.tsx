"use client";

import { CircleCheck, Copy, EllipsisVertical, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { DateInput, Select } from "@/components/ui/input";
import { addMonths, formatDate } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS, type FinanceType, type PaymentMethod } from "@/lib/domain";
import { deleteEntryAction, duplicateEntryAction, markPaidAction, undoPaidAction } from "./actions";

export type EntryActionsData = {
  id: number;
  type: FinanceType;
  description: string;
  amountLabel: string;
  dueDate: string;
  paid: boolean;
  method: PaymentMethod | null;
};

type Dialogs = "pay" | "undo" | "duplicate" | "delete" | null;

/**
 * Ações de um lançamento: marcar como recebido/pago (com data e método), desfazer, duplicar, editar e excluir.
 * `row`: botão principal + menu "Mais ações" (linhas da lista). `header`: todos os botões soltos (tela do lançamento).
 */
export function EntryActions({ entry, today, variant = "row" }: { entry: EntryActionsData; today: string; variant?: "row" | "header" }) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const stay = variant === "row";
  const receita = entry.type === "receita";
  const payLabel = receita ? "Marcar como recebido" : "Marcar como pago";
  const closeDialog = () => setDialog(null);

  return (
    <>
      <div className={variant === "row" ? "flex items-center gap-1.5 max-md:pt-1.5" : "contents"}>
        {!entry.paid ? (
          <Button variant={variant === "row" ? "secondary" : "primary"} icon={<CircleCheck />} onClick={() => setDialog("pay")}>
            {payLabel}
          </Button>
        ) : null}
        {variant === "row" ? (
          <DropdownMenu
            trigger={
              <IconButton aria-label={`Mais ações: ${entry.description}`} className="max-md:ml-auto">
                <EllipsisVertical />
              </IconButton>
            }
          >
            <DropdownMenuItem href={`/painel/financeiro/${entry.id}`} icon={<Pencil />}>
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem icon={<Copy />} onSelect={() => setDialog("duplicate")}>
              Duplicar
            </DropdownMenuItem>
            {entry.paid ? (
              <DropdownMenuItem icon={<Undo2 />} onSelect={() => setDialog("undo")}>
                {receita ? "Desfazer recebimento" : "Desfazer pagamento"}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" icon={<Trash2 />} onSelect={() => setDialog("delete")}>
              Excluir
            </DropdownMenuItem>
          </DropdownMenu>
        ) : (
          <>
            <Button variant="secondary" icon={<Copy />} onClick={() => setDialog("duplicate")}>
              Duplicar
            </Button>
            {entry.paid ? (
              <Button variant="secondary" icon={<Undo2 />} onClick={() => setDialog("undo")}>
                {receita ? "Desfazer recebimento" : "Desfazer pagamento"}
              </Button>
            ) : null}
            <Button variant="danger-ghost" icon={<Trash2 />} onClick={() => setDialog("delete")}>
              Excluir
            </Button>
          </>
        )}
      </div>

      <Dialog
        open={dialog === "pay"}
        onOpenChange={(open) => setDialog(open ? "pay" : null)}
        size="sm"
        title={payLabel}
        description={
          <>
            <strong className="text-grafite">{entry.description}</strong> · {entry.amountLabel}
          </>
        }
      >
        <ActionForm action={markPaidAction} hidden={{ id: entry.id }} onSuccess={closeDialog} className="space-y-4">
          <Field name="paidAt" label={receita ? "Data do recebimento" : "Data do pagamento"} required>
            <DateInput defaultValue={today} />
          </Field>
          <Field name="method" label="Método" optional>
            <Select options={PAYMENT_METHOD_LABELS} placeholder="Não informar" defaultValue={entry.method ?? ""} />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="Salvando…">Confirmar</SubmitButton>
          </FormActions>
        </ActionForm>
      </Dialog>

      <Dialog
        open={dialog === "duplicate"}
        onOpenChange={(open) => setDialog(open ? "duplicate" : null)}
        size="sm"
        title="Duplicar lançamento"
        description="Cria uma cópia como previsto (sem pagamento nem comprovante). Útil para contas que se repetem todo mês."
      >
        <ActionForm action={duplicateEntryAction} hidden={{ id: entry.id }} onSuccess={closeDialog} className="space-y-4">
          <Field name="dueDate" label="Vencimento da cópia" hint={`Sugestão: um mês depois de ${formatDate(entry.dueDate)}.`} required>
            <DateInput defaultValue={addMonths(entry.dueDate, 1)} />
          </Field>
          <FormActions>
            <SubmitButton pendingLabel="Duplicando…">Duplicar</SubmitButton>
          </FormActions>
        </ActionForm>
      </Dialog>

      <ConfirmDialog
        open={dialog === "undo"}
        onOpenChange={(open) => setDialog(open ? "undo" : null)}
        tone="primary"
        title={receita ? "Desfazer o recebimento?" : "Desfazer o pagamento?"}
        description="O lançamento volta a ser previsto, com o mesmo vencimento."
        confirmLabel="Desfazer"
        action={undoPaidAction}
        hidden={{ id: entry.id }}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title="Excluir este lançamento?"
        description={
          <>
            <strong className="text-grafite">{entry.description}</strong> ({entry.amountLabel}) será apagado e não dá para desfazer.
          </>
        }
        confirmLabel="Excluir lançamento"
        action={deleteEntryAction}
        hidden={{ id: entry.id, stay: stay ? "on" : undefined }}
      />
    </>
  );
}
