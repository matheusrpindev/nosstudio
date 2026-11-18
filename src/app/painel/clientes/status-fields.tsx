"use client";

import { useState } from "react";
import { Field } from "@/components/ui/form";
import { Select, Textarea } from "@/components/ui/input";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "@/lib/domain";

/**
 * Status do cliente + "motivo da perda", que só aparece (e é obrigatório) quando o status é "Perdido".
 * O select é não controlado de propósito: o React zera o formulário depois da action e um select controlado ficaria
 * mostrando o valor errado. Usado no formulário de cadastro/edição e no cartão "Andamento" da ficha.
 */
export function StatusFields({ defaultStatus, defaultLostReason = "" }: { defaultStatus: ClientStatus; defaultLostReason?: string }) {
  const [status, setStatus] = useState<ClientStatus>(defaultStatus);
  return (
    <>
      <Field name="status" label="Status" required>
        <Select options={CLIENT_STATUS_LABELS} defaultValue={defaultStatus} onChange={(event) => setStatus(event.target.value as ClientStatus)} />
      </Field>
      {status === "perdido" ? (
        <Field name="lostReason" label="Motivo da perda" hint="Preço, prazo, escolheu outro estúdio, desistiu do projeto…" required>
          <Textarea rows={2} maxLength={500} defaultValue={defaultLostReason} />
        </Field>
      ) : null}
    </>
  );
}
