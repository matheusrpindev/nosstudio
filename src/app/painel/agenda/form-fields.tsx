"use client";

/**
 * Campos próprios do formulário de compromisso. Cada um guarda o valor em estado e o envia em JSON num
 * `<input type="hidden">` (lido no servidor com `jsonField` e validado com zod em `src/server/agenda/input.ts`).
 */
import { FileText, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFieldState } from "@/components/ui/form";
import { formatBytes, uploadMedia, type MediaValue } from "@/components/ui/media-fields";
import { describeRecurrence, MAX_COUNT, MAX_INTERVAL, type Recurrence, type RecurrenceFreq } from "@/lib/agenda/recurrence";
import { cn } from "@/lib/cn";
import { isISODate, weekday, WEEKDAYS_SHORT, type ISODate } from "@/lib/dates";
import {
  AGENDA_REMINDER_CHANNEL_LABELS,
  AGENDA_REMINDER_CHANNELS,
  AGENDA_REMINDER_MAX_MINUTES,
  AGENDA_REMINDER_PRESETS,
  type AgendaReminderChannel,
} from "@/lib/domain";
import { describeReminder } from "./ui";

type Option = { value: number; label: string };
export type ChecklistItem = { id: string; text: string; done: boolean };
export type Reminder = { minutes: number; channel: AgendaReminderChannel };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now()}${Math.round(Math.random() * 1e6)}`);

function FieldError({ name, error }: { name: string; error?: string }) {
  const state = useFieldState(name);
  const message = error ?? state.error;
  return message ? <p className="field-error">{message}</p> : null;
}

// ------------------------------------------------------------------- pessoas
function PeopleGroup({ legend, hint, options, selected, onToggle }: { legend: string; hint?: string; options: Option[]; selected: number[]; onToggle: (id: number, checked: boolean) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco",
                checked ? "border-detalhe bg-detalhe-suave text-texto" : "border-borda-forte text-texto-suave hover:border-detalhe bg-superficie",
              )}
            >
              <input type="checkbox" data-controlled="" className="accent-primaria size-4" checked={checked} onChange={(event) => onToggle(option.value, event.target.checked)} />
              {option.label}
            </label>
          );
        })}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </fieldset>
  );
}

/** Responsáveis e participantes (usuários do painel). Quem é responsável não aparece duas vezes. */
export function PeopleField({ options, defaultResponsible, defaultParticipants }: { options: Option[]; defaultResponsible: number[]; defaultParticipants: number[] }) {
  const [responsible, setResponsible] = useState(defaultResponsible);
  const [participants, setParticipants] = useState(defaultParticipants);
  const toggle = (list: number[], id: number, checked: boolean) => (checked ? [...list.filter((item) => item !== id), id] : list.filter((item) => item !== id));
  return (
    <div className="space-y-5">
      <input type="hidden" name="responsibleIds" value={JSON.stringify(responsible)} />
      <input type="hidden" name="participantIds" value={JSON.stringify(participants)} />
      <PeopleGroup
        legend="Responsáveis"
        hint="Quem responde pelo compromisso. Entram na conferência de conflito de horários."
        options={options}
        selected={responsible}
        onToggle={(id, checked) => {
          setResponsible(toggle(responsible, id, checked));
          if (checked) setParticipants(participants.filter((item) => item !== id));
        }}
      />
      <PeopleGroup
        legend="Participantes"
        hint="Quem também vai estar presente."
        options={options.filter((option) => !responsible.includes(option.value))}
        selected={participants}
        onToggle={(id, checked) => setParticipants(toggle(participants, id, checked))}
      />
    </div>
  );
}

// ------------------------------------------------------------------ repetição
const FREQ_OPTIONS: { value: RecurrenceFreq | "nao"; label: string }[] = [
  { value: "nao", label: "Não se repete" },
  { value: "diaria", label: "Todos os dias" },
  { value: "semanal", label: "Toda semana" },
  { value: "mensal", label: "Todo mês" },
  { value: "anual", label: "Todo ano" },
];
const UNIT: Record<RecurrenceFreq, string> = { diaria: "dia(s)", semanal: "semana(s)", mensal: "mês(es)", anual: "ano(s)" };

/** Regra de repetição, com o resumo em português (`describeRecurrence`). `date` é a data do compromisso. */
export function RecurrenceField({ defaultValue, date }: { defaultValue: Recurrence | null; date: ISODate }) {
  const uid = useId();
  const [freq, setFreq] = useState<RecurrenceFreq | "nao">(defaultValue?.freq ?? "nao");
  const [interval, setIntervalValue] = useState(defaultValue?.interval ?? 1);
  const [weekdays, setWeekdays] = useState<number[]>([...(defaultValue?.weekdays ?? [])]);
  const [end, setEnd] = useState<"nunca" | "ate" | "vezes">(defaultValue?.until ? "ate" : defaultValue?.count ? "vezes" : "nunca");
  const [until, setUntil] = useState(defaultValue?.until ?? "");
  const [count, setCount] = useState(defaultValue?.count ?? 10);

  const validDate = isISODate(date);
  const rule: Recurrence | null =
    freq === "nao"
      ? null
      : {
          freq,
          interval: Math.min(MAX_INTERVAL, Math.max(1, interval || 1)),
          ...(freq === "semanal" && weekdays.length > 0 ? { weekdays: [...weekdays].sort() } : {}),
          ...(end === "ate" && isISODate(until) ? { until } : {}),
          ...(end === "vezes" ? { count: Math.min(MAX_COUNT, Math.max(1, count || 1)) } : {}),
        };
  const shownWeekdays = weekdays.length > 0 ? weekdays : validDate ? [weekday(date)] : [];

  return (
    <div className="space-y-4">
      <input type="hidden" name="recurrence" value={rule ? JSON.stringify(rule) : ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-freq`} className="label">
            Repetir
          </label>
          <select id={`${uid}-freq`} className="input" data-controlled="" value={freq} onChange={(event) => setFreq(event.target.value as RecurrenceFreq | "nao")}>
            {FREQ_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {freq !== "nao" ? (
          <div>
            <label htmlFor={`${uid}-int`} className="label">
              A cada
            </label>
            <div className="flex items-center gap-2">
              <input id={`${uid}-int`} type="number" inputMode="numeric" min={1} max={MAX_INTERVAL} className="input w-24" value={interval} onChange={(event) => setIntervalValue(Number(event.target.value))} />
              <span className="text-texto-suave text-sm">{UNIT[freq]}</span>
            </div>
          </div>
        ) : null}
      </div>

      {freq === "semanal" ? (
        <fieldset>
          <legend className="label">Nos dias</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS_SHORT.map((name, day) => {
              const checked = shownWeekdays.includes(day);
              return (
                <label
                  key={name}
                  className={cn(
                    "flex size-11 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold capitalize transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco",
                    checked ? "bg-primaria text-sobre-primaria border-transparent" : "border-borda-forte text-texto-suave hover:border-detalhe",
                  )}
                >
                  <input
                    type="checkbox"
                    data-controlled=""
                    className="sr-only"
                    checked={checked}
                    aria-label={["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][day]}
                    onChange={(event) => {
                      const base = shownWeekdays.filter((item) => item !== day);
                      const next = event.target.checked ? [...base, day] : base;
                      setWeekdays(next);
                    }}
                  />
                  {name.slice(0, 1)}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {freq !== "nao" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-fim`} className="label">
              Termina
            </label>
            <select id={`${uid}-fim`} className="input" data-controlled="" value={end} onChange={(event) => setEnd(event.target.value as "nunca" | "ate" | "vezes")}>
              <option value="nunca">Nunca</option>
              <option value="ate">Em uma data</option>
              <option value="vezes">Depois de um número de vezes</option>
            </select>
          </div>
          {end === "ate" ? (
            <div>
              <label htmlFor={`${uid}-ate`} className="label">
                Até o dia
              </label>
              <input id={`${uid}-ate`} type="date" className="input" min={validDate ? date : undefined} value={until} onChange={(event) => setUntil(event.target.value)} />
            </div>
          ) : null}
          {end === "vezes" ? (
            <div>
              <label htmlFor={`${uid}-vezes`} className="label">
                Quantas vezes
              </label>
              <input id={`${uid}-vezes`} type="number" inputMode="numeric" min={1} max={MAX_COUNT} className="input w-28" value={count} onChange={(event) => setCount(Number(event.target.value))} />
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-texto bg-superficie-alta rounded-campo px-3 py-2 text-sm" aria-live="polite">
        <span className="text-texto-suave">Resumo: </span>
        <strong className="font-semibold">{validDate ? describeRecurrence(date, rule) : "informe a data do compromisso"}</strong>
      </p>
      <FieldError name="recurrence" />
    </div>
  );
}

// ------------------------------------------------------------------ lembretes
const UNITS = [
  { value: 1, label: "minutos" },
  { value: 60, label: "horas" },
  { value: 1440, label: "dias" },
] as const;

/** Lembretes: antecedências prontas ou personalizada + canal. Quem envia é o despachante (`src/server/notifications/reminders.ts`). */
export function RemindersField({ defaultValue }: { defaultValue: Reminder[] }) {
  const uid = useId();
  const [items, setItems] = useState<Reminder[]>(defaultValue);
  const [choice, setChoice] = useState<string>(String(AGENDA_REMINDER_PRESETS[1].minutes));
  const [amount, setAmount] = useState(2);
  const [unit, setUnit] = useState<number>(60);
  const [channel, setChannel] = useState<AgendaReminderChannel>("interno");

  const add = () => {
    const minutes = choice === "custom" ? Math.round((amount || 0) * unit) : Number(choice);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > AGENDA_REMINDER_MAX_MINUTES) return;
    if (items.some((item) => item.minutes === minutes && item.channel === channel) || items.length >= 6) return;
    setItems([...items, { minutes, channel }].sort((a, b) => a.minutes - b.minutes));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name="reminders" value={JSON.stringify(items)} />
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lembretes configurados">
          {items.map((item) => (
            <li key={`${item.minutes}-${item.channel}`} className="border-borda-forte bg-superficie flex min-h-11 items-center gap-1 rounded-full border py-1 pr-1 pl-3.5 text-sm">
              <span className="text-texto font-medium">{describeReminder(item.minutes)}</span>
              <span className="text-texto-suave">· {AGENDA_REMINDER_CHANNEL_LABELS[item.channel]}</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm text-texto-suave"
                aria-label={`Remover lembrete: ${describeReminder(item.minutes)}, ${AGENDA_REMINDER_CHANNEL_LABELS[item.channel]}`}
                onClick={() => setItems(items.filter((other) => other !== item))}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-texto-suave text-sm">Nenhum lembrete configurado.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label htmlFor={`${uid}-quando`} className="label">
            Avisar
          </label>
          <select id={`${uid}-quando`} className="input" data-controlled="" value={choice} onChange={(event) => setChoice(event.target.value)}>
            {AGENDA_REMINDER_PRESETS.map((preset) => (
              <option key={preset.minutes} value={preset.minutes}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Personalizada…</option>
          </select>
        </div>
        {choice === "custom" ? (
          <div className="flex items-end gap-2">
            <div>
              <label htmlFor={`${uid}-qtd`} className="label">
                Antecedência
              </label>
              <input id={`${uid}-qtd`} type="number" inputMode="numeric" min={0} className="input w-24" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </div>
            <select aria-label="Unidade da antecedência" className="input w-32" data-controlled="" value={unit} onChange={(event) => setUnit(Number(event.target.value))}>
              {UNITS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="min-w-36">
          <label htmlFor={`${uid}-canal`} className="label">
            Por
          </label>
          <select id={`${uid}-canal`} className="input" data-controlled="" value={channel} onChange={(event) => setChannel(event.target.value as AgendaReminderChannel)}>
            {AGENDA_REMINDER_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {AGENDA_REMINDER_CHANNEL_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" icon={<Plus />} onClick={add} disabled={items.length >= 6}>
          Adicionar
        </Button>
      </div>
      <FieldError name="reminders" />
    </div>
  );
}

// ------------------------------------------------------------------ checklist
export type ChecklistTemplate = { id: number; name: string; categoryId: number | null; items: string[] };

/** Checklist com "usar modelo": os itens do modelo entram no fim da lista (sem repetir os que já existem). */
export function ChecklistField({
  name,
  label,
  defaultValue,
  templates = [],
  categoryId,
  placeholder = "Novo item",
}: {
  name: string;
  label: string;
  defaultValue: ChecklistItem[];
  templates?: ChecklistTemplate[];
  /** Categoria atual: os modelos dela aparecem primeiro. */
  categoryId?: number | null;
  placeholder?: string;
}) {
  const uid = useId();
  const [items, setItems] = useState<ChecklistItem[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const [template, setTemplate] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const sorted = [...templates].sort((a, b) => Number(b.categoryId === categoryId) - Number(a.categoryId === categoryId));

  const addDraft = () => {
    const text = draft.trim();
    if (!text || items.length >= 60) return;
    setItems([...items, { id: newId(), text: text.slice(0, 200), done: false }]);
    setDraft("");
    draftRef.current?.focus();
  };
  const applyTemplate = () => {
    const chosen = templates.find((item) => String(item.id) === template);
    if (!chosen) return;
    const existing = new Set(items.map((item) => item.text.trim().toLowerCase()));
    const added = chosen.items.filter((text) => !existing.has(text.trim().toLowerCase())).map((text) => ({ id: newId(), text, done: false }));
    setItems([...items, ...added].slice(0, 60));
    setTemplate("");
  };

  return (
    <div role="group" aria-labelledby={`${uid}-rotulo`}>
      <p id={`${uid}-rotulo`} className="label">
        {label}
      </p>
      {/* o texto digitado e ainda não adicionado também é enviado */}
      <input type="hidden" name={name} value={JSON.stringify(draft.trim() ? [...items, { id: `rascunho-${uid}`, text: draft.trim().slice(0, 200), done: false }] : items)} />
      {items.length > 0 ? (
        <ul className="divide-borda border-borda mb-3 divide-y rounded-campo border">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <input
                type="checkbox"
                data-controlled=""
                className="checkbox"
                checked={item.done}
                aria-label={`Feito: ${item.text || `item ${index + 1}`}`}
                onChange={(event) => setItems(items.map((other) => (other.id === item.id ? { ...other, done: event.target.checked } : other)))}
              />
              <input
                className={cn("text-texto min-h-11 min-w-0 flex-1 bg-transparent px-1 text-base outline-none focus-visible:outline-none", item.done && "text-texto-suave line-through")}
                aria-label={`Item ${index + 1}`}
                value={item.text}
                maxLength={200}
                onChange={(event) => setItems(items.map((other) => (other.id === item.id ? { ...other, text: event.target.value } : other)))}
              />
              <button type="button" className="btn btn-danger-ghost btn-icon" aria-label={`Remover: ${item.text || `item ${index + 1}`}`} onClick={() => setItems(items.filter((other) => other.id !== item.id))}>
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <input
          ref={draftRef}
          className="input"
          aria-label={`${label}: novo item`}
          placeholder={placeholder}
          value={draft}
          maxLength={200}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
        />
        <Button variant="secondary" icon={<Plus />} onClick={addDraft}>
          Adicionar
        </Button>
      </div>
      {sorted.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor={`${uid}-modelo`} className="text-texto-suave mb-1 block text-[0.8125rem] font-semibold">
              Usar modelo
            </label>
            <select id={`${uid}-modelo`} className="input" data-controlled="" value={template} onChange={(event) => setTemplate(event.target.value)}>
              <option value="">Escolha um modelo de checklist…</option>
              {sorted.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.items.length} {item.items.length === 1 ? "item" : "itens"})
                </option>
              ))}
            </select>
          </div>
          <Button variant="ghost" onClick={applyTemplate} disabled={!template}>
            Inserir itens
          </Button>
        </div>
      ) : null}
      <FieldError name={name} />
    </div>
  );
}

// --------------------------------------------------------------------- anexos
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif";
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 12;

/** Anexos privados (pipeline de upload do painel): sobem na hora; o formulário guarda só os ids. */
export function AttachmentsField({ defaultValue }: { defaultValue: MediaValue[] }) {
  const uid = useId();
  const [files, setFiles] = useState<MediaValue[]>(defaultValue);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef<HTMLSpanElement>(null);
  const blocked = useEffectEvent(() => setError("Aguarde o envio do arquivo terminar antes de salvar."));

  // enquanto um arquivo sobe, segura o envio do formulário (senão o compromisso seria salvo sem ele)
  useEffect(() => {
    const form = uploading ? guard.current?.closest("form") : null;
    if (!form) return;
    const block = (event: SubmitEvent) => {
      event.preventDefault();
      event.stopPropagation();
      blocked();
    };
    form.addEventListener("submit", block, true);
    return () => form.removeEventListener("submit", block, true);
  }, [uploading]);

  const send = async (list: FileList | null) => {
    setError(null);
    let current = files;
    for (const file of Array.from(list ?? [])) {
      if (current.length >= MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} anexos por compromisso.`);
        break;
      }
      if (file.size > MAX_BYTES) {
        setError(`Arquivo grande demais: "${file.name}" tem ${formatBytes(file.size)} (máximo de ${formatBytes(MAX_BYTES)}).`);
        continue;
      }
      setUploading({ name: file.name, progress: 0 });
      try {
        const uploaded = await uploadMedia(file, { visibility: "private", onProgress: (progress) => setUploading({ name: file.name, progress }) });
        current = [...current, uploaded];
        setFiles(current);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível enviar o arquivo. Tente de novo.");
      }
    }
    setUploading(null);
  };

  return (
    <div role="group" aria-labelledby={`${uid}-rotulo`}>
      <span ref={guard} hidden />
      <p id={`${uid}-rotulo`} className="sr-only">
        Anexos
      </p>
      <input type="hidden" name="attachments" value={JSON.stringify(files.map((file) => file.id))} />
      {files.length > 0 ? (
        <ul className="divide-borda border-borda mb-3 divide-y rounded-campo border">
          {files.map((file) => {
            const inline = file.mime === "application/pdf" || file.mime.startsWith("image/");
            return (
              <li key={file.id} className="flex items-center gap-3 py-1 pr-1 pl-3">
                <FileText aria-hidden="true" className="text-detalhe size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <a href={inline ? `${file.url}?inline=1` : file.url} target="_blank" rel="noopener noreferrer" className="link block truncate text-sm" title={file.originalName}>
                    {file.originalName}
                  </a>
                  <span className="text-texto-suave text-xs">{formatBytes(file.size)}</span>
                </span>
                <button type="button" className="btn btn-danger-ghost btn-icon" aria-label={`Remover anexo: ${file.originalName}`} onClick={() => setFiles(files.filter((other) => other.id !== file.id))}>
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {uploading ? (
        <p className="text-texto mb-3 text-sm" role="status">
          Enviando {uploading.name}… {Math.round(uploading.progress * 100)}%
        </p>
      ) : null}
      <label className={cn("btn btn-secondary", (uploading || files.length >= MAX_FILES) && "pointer-events-none opacity-55")}>
        <Paperclip aria-hidden="true" className="size-[1.125rem]" />
        Anexar arquivo
        <input
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading !== null || files.length >= MAX_FILES}
          onChange={(event) => {
            void send(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="hint">PDF, documentos, planilhas, imagens ou zip, até 25 MB cada. Só quem entra no painel consegue abrir.</p>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <FieldError name="attachments" />
    </div>
  );
}
