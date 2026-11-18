"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFieldContext, useFieldState } from "./form";

/**
 * Liga um controle nativo ao `<Field>` que o envolve: id, name, aria-invalid, aria-describedby, required e o
 * valor digitado a repopular depois de um erro da action. Props passadas direto no controle têm prioridade.
 */
function useControlProps<P extends { id?: string; name?: string; required?: boolean; "aria-describedby"?: string; "aria-invalid"?: unknown }>(props: P) {
  const field = useFieldContext();
  const name = props.name ?? field?.name;
  // dentro de um Field o valor a repopular já vem dele; fora, busca direto no ActionForm pelo name
  const own = useFieldState(field ? undefined : name);
  return {
    id: props.id ?? field?.id,
    name,
    required: props.required ?? field?.required,
    "aria-invalid": (props["aria-invalid"] as boolean | undefined) ?? (field?.invalid || Boolean(own.error) || undefined),
    "aria-describedby": props["aria-describedby"] ?? field?.describedBy,
    /** valor a repopular (só para controles não controlados) */
    repopulate: field ? field.value : own.value,
    submitted: field ? field.submitted : own.submitted,
  };
}

export type InputProps = ComponentProps<"input">;

/** `<input>` com o visual do painel. Dentro de um `<Field>` não precisa de id/name. */
export function Input({ className, defaultValue, ...props }: InputProps) {
  const { repopulate, submitted: _submitted, ...control } = useControlProps(props);
  const uncontrolled = props.value === undefined;
  return (
    <input
      {...props}
      {...control}
      {...(uncontrolled ? { defaultValue: repopulate ?? defaultValue } : null)}
      className={cn("input", className)}
    />
  );
}

/** Data nativa (`YYYY-MM-DD` no envio; o navegador mostra no formato local). Combine com `f.date()`/`f.optionalDate()`. */
export function DateInput(props: Omit<InputProps, "type">) {
  return <Input {...props} type="date" />;
}

/** Horário nativo (`HH:mm`). Combine com `f.optionalTime()`. */
export function TimeInput(props: Omit<InputProps, "type">) {
  return <Input {...props} type="time" />;
}

export type TextareaProps = ComponentProps<"textarea"> & {
  /** Cresce com o conteúdo (padrão: sim). */
  autoGrow?: boolean;
};

/** `<textarea>` que cresce conforme o texto. */
export function Textarea({ className, defaultValue, autoGrow = true, onInput, rows = 3, ...props }: TextareaProps) {
  const { repopulate, submitted: _submitted, ...control } = useControlProps(props);
  const ref = useRef<HTMLTextAreaElement>(null);
  const uncontrolled = props.value === undefined;
  const initial = uncontrolled ? (repopulate ?? defaultValue) : props.value;

  const resize = () => {
    const el = ref.current;
    if (!el || !autoGrow) return;
    el.style.height = "auto";
    // +2: bordas (o scrollHeight não as inclui)
    el.style.height = `${el.scrollHeight + 2}px`;
  };
  useEffect(resize); // ajusta na montagem e quando o valor muda por fora (reset, repopular)

  return (
    <textarea
      {...props}
      {...control}
      ref={ref}
      rows={rows}
      {...(uncontrolled ? { defaultValue: initial } : null)}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn("input", autoGrow && "resize-none overflow-hidden", className)}
    />
  );
}

export type SelectOption = { value: string | number; label: string; disabled?: boolean };

/** Aceita uma lista `{ value, label }` ou direto um mapa de rótulos de `src/lib/domain.ts`. */
export type SelectOptions = readonly SelectOption[] | Readonly<Record<string, string>>;

export function normalizeOptions(options: SelectOptions): readonly SelectOption[] {
  return Array.isArray(options) ? (options as readonly SelectOption[]) : Object.entries(options).map(([value, label]) => ({ value, label: label as string }));
}

export type SelectProps = Omit<ComponentProps<"select">, "children"> & {
  /** Lista `{ value, label }` ou um mapa de rótulos (ex.: `options={LEAD_STATUS_LABELS}`). */
  options?: SelectOptions;
  /** Primeira opção vazia (ex.: "Selecione…" ou "Todos"). */
  placeholder?: string;
  children?: ReactNode;
};

/** `<select>` nativo (melhor no celular). */
export function Select({ className, options, placeholder, children, defaultValue, ...props }: SelectProps) {
  const { repopulate, submitted: _submitted, ...control } = useControlProps(props);
  const uncontrolled = props.value === undefined;
  const initial = repopulate ?? defaultValue;
  return (
    <select
      // Remonta quando o valor inicial muda (erro repopulado, ou novo valor salvo vindo do servidor): o reset
      // automático do formulário depois da action devolveria o select à opção inicial ANTIGA.
      key={uncontrolled ? String(initial ?? "") : undefined}
      {...props}
      {...control}
      {...(uncontrolled ? { defaultValue: initial } : { "data-controlled": "" })}
      className={cn("input", className)}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options
        ? normalizeOptions(options).map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))
        : null}
      {children}
    </select>
  );
}

export type SearchInputProps = Omit<InputProps, "type"> & {
  /** Rótulo para leitores de tela (o campo não tem label visível). */
  label?: string;
  wrapperClassName?: string;
};

/** Campo de busca com lupa. `name="q"` por padrão. Em listas, use dentro do `<FilterBar>`. */
export function SearchInput({ label = "Buscar", name = "q", placeholder = "Buscar…", className, wrapperClassName, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search aria-hidden="true" className="text-cinza pointer-events-none absolute top-1/2 left-3 size-[1.125rem] -translate-y-1/2" />
      <input type="search" name={name} aria-label={label} placeholder={placeholder} enterKeyHint="search" {...props} className={cn("input pl-10", className)} />
    </div>
  );
}

export type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  /** Texto ao lado da caixa (clicável). */
  label: ReactNode;
  hint?: ReactNode;
};

/** Checkbox com rótulo clicável (linha inteira ≥ 44px). No schema: `f.checkbox()`. */
export function Checkbox({ label, hint, className, defaultChecked, ...props }: CheckboxProps) {
  const state = useFieldState(props.name);
  const uncontrolled = props.checked === undefined;
  // depois de um erro, repopula: campo presente em `values` = marcado; ausente = desmarcado
  const checked = state.submitted && props.value === undefined ? state.value !== undefined : defaultChecked;
  return (
    <div className={className}>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input
          type="checkbox"
          {...props}
          {...(uncontrolled ? { defaultChecked: checked } : { "data-controlled": "" })}
          aria-invalid={state.error ? true : undefined}
          className="checkbox mt-px"
        />
        <span className="min-w-0 text-sm leading-snug">
          <span className="text-grafite font-medium">{label}</span>
          {hint ? <span className="text-cinza mt-0.5 block text-[0.8125rem]">{hint}</span> : null}
        </span>
      </label>
      {state.error ? <p className="field-error mt-0">{state.error}</p> : null}
    </div>
  );
}

export type RadioCardOption = { value: string; label: ReactNode; description?: ReactNode; disabled?: boolean };

export type RadioCardsProps = {
  /** Dentro de um `<Field group name="…">` o name vem do Field. */
  name?: string;
  options: readonly RadioCardOption[];
  defaultValue?: string;
  /** Modo controlado. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Colunas no desktop (no celular, sempre 1 — ou 2 com `compact`). */
  cols?: 1 | 2 | 3 | 4;
  /** Cartões baixos, sem descrição, 2 por linha no celular. */
  compact?: boolean;
  required?: boolean;
  className?: string;
};

const RADIO_COLS = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

/** Escolha única em cartões (radios nativos: setas do teclado funcionam). Use dentro de `<Field group …>`. */
export function RadioCards({ name, options, defaultValue, value, onValueChange, cols = 2, compact, required, className }: RadioCardsProps) {
  const field = useFieldContext();
  const groupName = name ?? field?.name;
  const initial = field?.value ?? defaultValue;
  return (
    <div className={cn("grid gap-2", compact && "grid-cols-2", RADIO_COLS[cols], className)}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "radio-card border-areia-escuro relative flex cursor-pointer items-start gap-3 rounded-campo border bg-white px-3.5 transition-colors",
            compact ? "min-h-11 items-center py-2" : "py-3",
            option.disabled && "cursor-not-allowed opacity-55",
          )}
        >
          <input
            type="radio"
            name={groupName}
            value={option.value}
            disabled={option.disabled}
            required={required ?? field?.required}
            {...(value !== undefined
              ? { checked: value === option.value, onChange: () => onValueChange?.(option.value), "data-controlled": "" }
              : { defaultChecked: initial === option.value, onChange: () => onValueChange?.(option.value) })}
            className="accent-roxo mt-0.5 size-[1.125rem] shrink-0 cursor-pointer"
          />
          <span className="min-w-0 text-sm leading-snug">
            <span className="text-grafite block font-semibold">{option.label}</span>
            {option.description && !compact ? <span className="text-cinza mt-0.5 block text-[0.8125rem]">{option.description}</span> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
