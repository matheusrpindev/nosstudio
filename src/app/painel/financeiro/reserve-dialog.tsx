"use client";

import { PiggyBank, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/masked-inputs";
import { saveReserveAction } from "./actions";

export function ReserveDialog({ valueCents, goalCents, note }: { valueCents: number; goalCents: number; note: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      trigger={
        <Button variant="secondary" size="sm" icon={<Pencil />} className="max-md:min-h-11">
          Editar reserva
        </Button>
      }
      title="Reserva de caixa"
      description="O valor é informado por vocês: o painel não consulta banco. Atualize quando guardar ou usar a reserva."
    >
      <ActionForm action={saveReserveAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <Field name="cashReserve" label="Valor atual da reserva" required>
          <MoneyInput defaultValue={valueCents} />
        </Field>
        <Field name="goal" label="Meta da reserva" optional hint="Deixe vazio se ainda não tem meta.">
          <MoneyInput defaultValue={goalCents > 0 ? goalCents : null} />
        </Field>
        <Field name="note" label="Anotação" optional hint="Ex.: onde está guardada, regra de uso.">
          <Textarea rows={2} maxLength={1000} defaultValue={note} />
        </Field>
        <FormActions>
          <SubmitButton icon={<PiggyBank />} pendingLabel="Salvando…">
            Salvar reserva
          </SubmitButton>
        </FormActions>
      </ActionForm>
    </Dialog>
  );
}
