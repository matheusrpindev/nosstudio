"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { DateInput, Input, Select, TimeInput } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { minutesToTime, timeToMinutes } from "@/lib/agenda/conflicts";
import type { ISODate } from "@/lib/dates";
import { quickCreateEventAction, type EventActionData } from "../actions";
import { FormFeedback } from "../feedback";

export type QuickSlot = { date: ISODate; startTime: string | null; endTime?: string | null };
type Option = { value: number; label: string };

const QuickCreateContext = createContext<((slot: QuickSlot) => void) | null>(null);

/** Abre a criação rápida num dia/horário. `null` quando a pessoa não pode criar compromissos. */
export function useQuickCreate() {
  return use(QuickCreateContext);
}

const plusHour = (time: string) => minutesToTime(Math.min(timeToMinutes(time) + 60, 23 * 60 + 59));

/**
 * Envolve as visões da agenda e guarda o diálogo de criação rápida (título, data, horário, categoria, agenda).
 * "Mais opções" leva o que já foi digitado para o formulário completo.
 */
export function QuickCreateProvider({
  children,
  enabled,
  categories,
  calendars,
  defaultCategoryId,
  defaultCalendarId,
  returnTo,
}: {
  children: ReactNode;
  enabled: boolean;
  categories: Option[];
  calendars: Option[];
  defaultCategoryId: number | null;
  defaultCalendarId: number | null;
  /** URL da agenda como está agora (para voltar depois do formulário completo). */
  returnTo: string;
}) {
  const [slot, setSlot] = useState<(QuickSlot & { n: number }) | null>(null);
  const [counter, setCounter] = useState(0);
  const open = (next: QuickSlot) => {
    setCounter((n) => n + 1);
    setSlot({ ...next, n: counter + 1 });
  };
  return (
    <QuickCreateContext value={enabled ? open : null}>
      {children}
      <Dialog open={slot !== null} onOpenChange={(isOpen) => (isOpen ? null : setSlot(null))} title="Novo compromisso" size="md">
        {slot ? (
          <QuickForm
            key={slot.n}
            slot={slot}
            categories={categories}
            calendars={calendars}
            defaultCategoryId={defaultCategoryId}
            defaultCalendarId={defaultCalendarId}
            returnTo={returnTo}
            onDone={() => setSlot(null)}
          />
        ) : null}
      </Dialog>
    </QuickCreateContext>
  );
}

function QuickForm({
  slot,
  categories,
  calendars,
  defaultCategoryId,
  defaultCalendarId,
  returnTo,
  onDone,
}: {
  slot: QuickSlot;
  categories: Option[];
  calendars: Option[];
  defaultCategoryId: number | null;
  defaultCalendarId: number | null;
  returnTo: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [allDay, setAllDay] = useState(slot.startTime === null);
  const formRef = useRef<HTMLDivElement>(null);
  const start = slot.startTime ?? "09:00";

  const moreOptions = () => {
    const form = formRef.current?.closest("form");
    if (!form) return;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    const params = new URLSearchParams({ data: text("date") || slot.date });
    if (text("title").trim()) params.set("titulo", text("title").trim());
    if (allDay) params.set("diaInteiro", "1");
    else {
      if (text("startTime")) params.set("inicio", text("startTime"));
      if (text("endTime")) params.set("fim", text("endTime"));
    }
    if (text("categoryId")) params.set("categoria", text("categoryId"));
    if (text("calendarId")) params.set("agenda", text("calendarId"));
    params.set("voltar", returnTo);
    router.push(`/painel/agenda/novo?${params}`);
  };

  return (
    <ActionForm<EventActionData> action={quickCreateEventAction} hideError onSuccess={onDone} className="space-y-4">
      <div ref={formRef} className="contents" />
      <FormFeedback />
      <Field name="title" label="Título" required>
        <Input autoFocus autoComplete="off" maxLength={160} placeholder="Ex.: Reunião de pauta" />
      </Field>
      <Field name="date" label="Data" required>
        <DateInput defaultValue={slot.date} />
      </Field>
      <Switch name="allDay" label="Dia inteiro" checked={allDay} onCheckedChange={setAllDay} />
      {allDay ? null : (
        <FieldRow className="!grid-cols-2 gap-3">
          <Field name="startTime" label="Início" required>
            <TimeInput defaultValue={start} />
          </Field>
          <Field name="endTime" label="Fim" optional>
            <TimeInput defaultValue={slot.endTime ?? plusHour(start)} />
          </Field>
        </FieldRow>
      )}
      <FieldRow className="gap-3">
        <Field name="categoryId" label="Categoria" required>
          <Select options={categories} defaultValue={defaultCategoryId ?? categories[0]?.value ?? ""} />
        </Field>
        <Field name="calendarId" label="Agenda" required>
          <Select options={calendars} defaultValue={defaultCalendarId ?? calendars[0]?.value ?? ""} />
        </Field>
      </FieldRow>
      <FormActions className="sm:flex-row-reverse sm:justify-start">
        <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
        <Button variant="ghost" onClick={moreOptions}>
          Mais opções
        </Button>
      </FormActions>
    </ActionForm>
  );
}

/**
 * Botão que abre a criação rápida num dia/horário (célula vazia do mês, faixa de dia inteiro, "+" do dia).
 * Não renderiza nada para quem não pode criar.
 */
export function SlotButton({
  date,
  startTime = null,
  endTime,
  className,
  label,
  children,
}: Omit<QuickSlot, "startTime"> & { startTime?: string | null; className?: string; label: string; children?: ReactNode }) {
  const open = useQuickCreate();
  if (!open) return null;
  return (
    <button type="button" className={className} aria-label={label} title={label} onClick={() => open({ date, startTime, endTime })}>
      {children}
    </button>
  );
}
