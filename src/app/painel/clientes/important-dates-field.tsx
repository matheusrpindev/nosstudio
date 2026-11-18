"use client";

import { ObjectListField } from "@/components/ui/list-fields";
import type { LabeledDate } from "@/db/schema";

/** Datas importantes do cliente (aniversário, renovação, evento…): rótulo + data. */
export function ImportantDatesField({ defaultValue }: { defaultValue: LabeledDate[] }) {
  return (
    <ObjectListField<LabeledDate>
      name="importantDates"
      label="Datas importantes"
      hint="Aniversário do cliente, renovação do pacote, data do evento…"
      defaultValue={defaultValue}
      addLabel="Adicionar data"
      max={30}
      emptyLabel="Nenhuma data importante cadastrada."
      createItem={() => ({ label: "", date: "" })}
      itemLabel={(item, index) => item.label || `data ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_11rem]">
          <input className="input" aria-label={`Descrição da data ${index + 1}`} placeholder="Ex.: Aniversário" maxLength={80} value={item.label} onChange={(event) => update({ label: event.target.value })} />
          <input className="input" type="date" aria-label={`Data ${index + 1}`} value={item.date} onChange={(event) => update({ date: event.target.value })} />
        </div>
      )}
    />
  );
}
