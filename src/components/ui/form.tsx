"use client";

import { createContext, Fragment, use, useActionState, useEffect, useEffectEvent, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { keepChoicesOnReset } from "@/lib/form-reset";
import { Alert } from "./alert";
import { Button, type ButtonProps } from "./button";
import { toast } from "./toast";

/** Assinatura das Server Actions de formulário (ver `src/server/action.ts`). */
export type FormAction<TData = undefined> = (prev: ActionState<TData>, formData: FormData) => Promise<ActionState<TData>>;

type FormContextValue = { state: ActionState<unknown>; pending: boolean };
const FormContext = createContext<FormContextValue | null>(null);

/** Estado do `<ActionForm>` mais próximo (`null` fora de um). Útil para componentes de campo próprios. */
export function useActionFormState(): FormContextValue | null {
  return use(FormContext);
}

/** Erro e valor a repopular de um campo, pelo `name`. Funciona fora de um `<ActionForm>` (devolve vazio). */
export function useFieldState(name: string | undefined): { error?: string; value?: string; submitted: boolean } {
  const form = use(FormContext);
  if (!form || !name) return { submitted: false };
  const values = form.state.ok ? undefined : form.state.values;
  return { error: form.state.ok ? undefined : form.state.fieldErrors?.[name], value: values?.[name], submitted: values !== undefined };
}

export type ActionFormProps<TData = undefined> = Omit<ComponentProps<"form">, "action" | "children" | "hidden"> & {
  /** Server Action no formato `(prev: ActionState, formData) => Promise<ActionState>`. */
  action: FormAction<TData>;
  children: ReactNode;
  /** Campos ocultos enviados junto (ex.: `hidden={{ id: lead.id }}`). */
  hidden?: Record<string, string | number | null | undefined>;
  /**
   * Como mostrar `state.message` quando `ok: true`:
   * `toast` (padrão) · `inline` (bloco verde no topo, para telas sem navegação depois) · `none`.
   */
  success?: "toast" | "inline" | "none";
  /** Chamado uma vez a cada resposta `ok: true` (fechar diálogo, limpar seleção…). */
  onSuccess?: (state: ActionState<TData>) => void;
  /** Remonta os campos após o sucesso (limpa também widgets controlados). Use em formulários de "adicionar". */
  resetOnSuccess?: boolean;
  /** Esconde o bloco de erro geral (quando a mensagem é mostrada de outro jeito). */
  hideError?: boolean;
};

/**
 * Formulário ligado a uma Server Action com `useActionState`.
 * - mostra o erro geral (`state.message`) num bloco `role="alert"` e foca o primeiro campo inválido;
 * - os `<Field>` de dentro acham o próprio erro pelo `name` e repopulam o que foi digitado (`state.values`);
 * - sucesso com mensagem vira toast.
 */
export function ActionForm<TData = undefined>({
  action,
  children,
  hidden,
  success = "toast",
  onSuccess,
  resetOnSuccess,
  hideError,
  className,
  ...rest
}: ActionFormProps<TData>) {
  // O aviso de sucesso é mostrado assim que a action responde, e não num efeito deste componente: quando a
  // resposta já traz a tela nova (`refresh()`) e o formulário sai dela — um botão que só existe num status, por
  // exemplo —, o efeito nunca rodaria e o aviso se perderia.
  const toasted = useRef<number | undefined>(undefined);
  const run = async (previous: ActionState<TData>, formData: FormData): Promise<ActionState<TData>> => {
    const next = await action(previous, formData);
    if (next?.ok && next.message && success === "toast") {
      toast(next.message);
      toasted.current = next.nonce;
    }
    return next;
  };
  const [state, formAction, pending] = useActionState(run, initialActionState as ActionState<TData>);
  const formRef = useRef<HTMLFormElement>(null);

  // Remonta os campos a cada sucesso (padrão "ajustar estado durante o render", sem efeito).
  const [resetKey, setResetKey] = useState<number | undefined>(undefined);
  if (resetOnSuccess && state.ok && state.nonce !== resetKey) setResetKey(state.nonce);

  const onResponse = useEffectEvent(() => {
    if (state.ok) {
      if (success === "toast" && state.message && toasted.current !== state.nonce) toast(state.message);
      onSuccess?.(state);
    } else {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
  });
  // Reage uma vez a cada resposta da action (o nonce muda a cada resposta).
  useEffect(() => {
    if (state.nonce !== undefined) onResponse();
  }, [state.nonce]);

  return (
    // onReset: o reset automático do React depois da action não pode desmarcar campos controlados (ver form-reset.ts)
    <form ref={formRef} action={formAction} className={cn("space-y-5", className)} noValidate onReset={(event) => keepChoicesOnReset(event, true)} {...rest}>
      {hidden
        ? Object.entries(hidden).map(([name, value]) => (value == null ? null : <input key={name} type="hidden" name={name} value={String(value)} />))
        : null}
      {!state.ok && state.message && !hideError ? (
        <Alert tone="perigo" role="alert">
          {state.message}
        </Alert>
      ) : null}
      {state.ok && state.message && success === "inline" ? (
        <Alert tone="sucesso" role="status">
          {state.message}
        </Alert>
      ) : null}
      <FormContext value={{ state, pending }}>
        <Fragment key={resetKey ?? "inicial"}>{children}</Fragment>
      </FormContext>
    </form>
  );
}

export type SubmitButtonProps = Omit<ButtonProps, "type" | "loading"> & {
  /** Texto enquanto envia (padrão: mantém o texto e mostra o spinner). */
  pendingLabel?: string;
};

/** Botão de envio: mostra o spinner e se desabilita enquanto a action do `<form>` pai roda (`useFormStatus`). */
export function SubmitButton({ children, pendingLabel, disabled, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={disabled} {...rest}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Linha de botões no fim de um formulário (ação principal primeiro; empilha no celular). */
export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-2 pt-1 sm:flex-row sm:items-center", className)}>{children}</div>;
}

// ---------------------------------------------------------------------- Field
type FieldContextValue = {
  id: string;
  name?: string;
  invalid: boolean;
  describedBy?: string;
  required?: boolean;
  /** Valor digitado a repopular depois de um erro da action. */
  value?: string;
  /** `true` quando há valores devolvidos pela action (campo ausente = desmarcado/vazio). */
  submitted: boolean;
};
const FieldContext = createContext<FieldContextValue | null>(null);

/** Para controles próprios dentro de um `<Field>`: id, name, aria e valor a repopular. `null` fora de um Field. */
export function useFieldContext(): FieldContextValue | null {
  return use(FieldContext);
}

export type FieldProps = {
  /** `name` do controle: é por ele que o erro (`fieldErrors[name]`) e o valor a repopular são encontrados. */
  name?: string;
  label: ReactNode;
  /** Texto de ajuda abaixo do controle. */
  hint?: ReactNode;
  /** Erro manual (fora de um ActionForm, ou para sobrepor o da action). */
  error?: string;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo. */
  optional?: boolean;
  /** Para grupos (RadioCards, vários checkboxes): renderiza `<fieldset>` + `<legend>` em vez de `<label>`. */
  group?: boolean;
  /** Esconde o rótulo visualmente (continua lido por leitores de tela). */
  hideLabel?: boolean;
  className?: string;
  /** O controle: `<Input />`, `<Textarea />`, `<Select />`, `<DateInput />`… (recebem id/name/aria sozinhos). */
  children: ReactNode;
};

/**
 * Rótulo + controle + ajuda + erro. O controle de dentro (Input, Select…) recebe `id`, `name`,
 * `aria-invalid`, `aria-describedby`, `required` e o valor a repopular automaticamente.
 */
export function Field({ name, label, hint, error, required, optional, group, hideLabel, className, children }: FieldProps) {
  const id = useId();
  const state = useFieldState(name);
  const message = error ?? state.error;
  const hintId = hint ? `${id}-ajuda` : undefined;
  const errorId = message ? `${id}-erro` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const labelContent = (
    <>
      {label}
      {optional ? <span className="text-cinza font-normal"> (opcional)</span> : null}
    </>
  );
  const body = (
    <FieldContext value={{ id, name, invalid: Boolean(message), describedBy, required, value: state.value, submitted: state.submitted }}>
      {children}
      {message ? (
        <p id={errorId} className="field-error">
          {message}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
    </FieldContext>
  );

  if (group) {
    return (
      <fieldset className={cn("min-w-0", className)} aria-describedby={describedBy} aria-invalid={message ? true : undefined}>
        <legend className={cn("label", hideLabel && "sr-only")}>{labelContent}</legend>
        {body}
      </fieldset>
    );
  }
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className={cn("label", hideLabel && "sr-only")}>
        {labelContent}
      </label>
      {body}
    </div>
  );
}

/** Grade responsiva para campos lado a lado (1 coluna no celular, `cols` no desktop). */
export function FieldRow({ cols = 2, children, className }: { cols?: 2 | 3; children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-5", cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3", className)}>{children}</div>;
}
