"use client";

import { Alert } from "@/components/ui/alert";
import { SubmitButton, useActionFormState } from "@/components/ui/form";
import { formatDate } from "@/lib/dates";
import type { EventActionData } from "./actions";

/**
 * Retorno das actions de compromisso dentro de um `<ActionForm hideError>`: erro comum em vermelho, ou o AVISO
 * de conflito de horários com a lista do que choca e o botão "Salvar mesmo assim" (reenvia o mesmo formulário
 * com `ignoreConflicts=1` — conflito avisa, não proíbe).
 */
export function FormFeedback({ confirmLabel = "Salvar mesmo assim" }: { confirmLabel?: string }) {
  const form = useActionFormState();
  if (!form || form.state.ok || !form.state.message) return null;
  const data = form.state.data as EventActionData | undefined;
  if (!data?.conflicts?.length) {
    return (
      <Alert tone="perigo" role="alert">
        {form.state.message}
      </Alert>
    );
  }
  return (
    <Alert tone="alerta" role="alert" title={data.total === 1 ? "Conflito de horário" : `${data.total} conflitos de horário`}>
      <p>As pessoas abaixo já têm compromisso nesse horário:</p>
      <ul className="mt-2 space-y-1">
        {data.conflicts.map((conflict, index) => (
          <li key={index} className="flex flex-wrap gap-x-2">
            <span className="font-semibold tabular-nums">
              {formatDate(conflict.date)} · {conflict.startTime ? `${conflict.startTime}${conflict.endTime ? ` – ${conflict.endTime}` : ""}` : "dia inteiro"}
            </span>
            <span className="min-w-0 break-words">
              {conflict.title}
              {conflict.people.length ? ` — ${conflict.people.join(", ")}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {data.total > data.conflicts.length ? <p className="text-texto-suave mt-1">…e mais {data.total - data.conflicts.length}.</p> : null}
      <p className="mt-2">Ajuste a data, o horário ou as pessoas — ou salve assim mesmo.</p>
      <SubmitButton name="ignoreConflicts" value="1" variant="secondary" size="sm" className="mt-3" pendingLabel="Salvando…">
        {confirmLabel}
      </SubmitButton>
    </Alert>
  );
}
