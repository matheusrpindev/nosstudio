"use client";

import { CalendarOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FieldRow, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select } from "@/components/ui/input";
import type { ISODate } from "@/lib/dates";
import { blockPeriodAction } from "../actions";

type Props = {
  /** Pessoas que esta conta pode bloquear (quem só mexe na própria agenda recebe só a si mesma). */
  people: { value: number; label: string }[];
  defaultPersonId: number;
  defaultDate: ISODate;
};

/**
 * "Bloquear período": férias, folga, viagem. Cria um compromisso de dia inteiro, do primeiro ao último dia, numa
 * categoria que bloqueia o dia — a pessoa aparece indisponível e marcar algo com ela nesses dias gera aviso.
 */
export function BlockPeriod({ people, defaultPersonId, defaultDate }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="secondary" icon={<CalendarOff />}>
          Bloquear período
        </Button>
      }
      title="Bloquear período"
      description="Férias, folga ou viagem: a pessoa fica indisponível nesses dias, e marcar algo com ela gera aviso de conflito."
    >
      <ActionForm action={blockPeriodAction} onSuccess={() => setOpen(false)} className="space-y-4">
        {people.length > 1 ? (
          <Field name="personId" label="Pessoa" required>
            <Select options={people} defaultValue={defaultPersonId} />
          </Field>
        ) : (
          <input type="hidden" name="personId" value={people[0]?.value ?? defaultPersonId} />
        )}
        <FieldRow className="!grid-cols-2 gap-3">
          <Field name="date" label="Primeiro dia" required>
            <DateInput defaultValue={defaultDate} />
          </Field>
          <Field name="endDate" label="Último dia" required>
            <DateInput defaultValue={defaultDate} />
          </Field>
        </FieldRow>
        <Field name="title" label="Motivo" optional hint="Aparece na agenda. Em branco, fica “Indisponível”.">
          <Input autoComplete="off" maxLength={160} placeholder="Ex.: Férias" />
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Voltar
          </Button>
          <SubmitButton pendingLabel="Salvando…">Bloquear</SubmitButton>
        </div>
      </ActionForm>
    </Dialog>
  );
}
