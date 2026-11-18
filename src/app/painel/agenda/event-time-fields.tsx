"use client";

import { useState } from "react";
import { Field, FieldRow } from "@/components/ui/form";
import { TimeInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/** "Dia inteiro" liga/desliga os campos de início e fim. Os horários só são enviados quando o dia não é inteiro. */
export function EventTimeFields({ defaultAllDay, defaultStart, defaultEnd }: { defaultAllDay: boolean; defaultStart: string | null; defaultEnd: string | null }) {
  const [allDay, setAllDay] = useState(defaultAllDay);
  return (
    <div>
      <Switch name="allDay" label="Dia inteiro" hint="Sem horário marcado (ex.: viagem, entrega do dia)." checked={allDay} onCheckedChange={setAllDay} />
      {allDay ? null : (
        <FieldRow className="mt-2">
          <Field name="startTime" label="Início" required>
            <TimeInput defaultValue={defaultStart ?? ""} />
          </Field>
          <Field name="endTime" label="Fim" optional>
            <TimeInput defaultValue={defaultEnd ?? ""} />
          </Field>
        </FieldRow>
      )}
    </div>
  );
}
