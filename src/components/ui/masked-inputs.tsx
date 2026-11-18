"use client";

/**
 * Campos com máscara para formulários do painel.
 * - <MoneyInput>: valor em reais; envia o TEXTO formatado ("10.900,00") — o servidor converte com f.money()/parseBRL.
 * - <PhoneInput>: telefone brasileiro; envia o texto formatado ("(11) 91234-5678").
 * Ambos repassam os atributos usuais de <input> (id, required, aria-*, className…).
 */
import { useId, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { centsToInput, onlyDigits } from "@/lib/format";

// ------------------------------------------------------------------ dinheiro
/** Maior valor aceito pela máscara: R$ 999.999.999,99. */
const MAX_MONEY_DIGITS = 11;

/** Dígitos digitados → texto `10.900,00` (os dois últimos dígitos são os centavos). Vazio continua vazio. */
export function maskMoney(text: string): string {
  const digits = onlyDigits(text).replace(/^0+(?=\d)/, "").slice(0, MAX_MONEY_DIGITS);
  if (!digits) return "";
  return centsToInput(Number(digits));
}

/** Texto mascarado → centavos (ou `null` se vazio). */
export function moneyToCents(text: string): number | null {
  const digits = onlyDigits(text);
  return digits ? Number(digits) : null;
}

type NativeInput = Omit<ComponentProps<"input">, "defaultValue" | "value" | "onChange" | "type">;

export type MoneyInputProps = NativeInput & {
  /** Valor inicial em CENTAVOS (ex.: 1090000 → "10.900,00"). `null`/ausente = campo vazio. */
  defaultValue?: number | null;
  /** Modo controlado, em centavos (use com `onValueChange`) — útil dentro de listas (<ObjectListField>). */
  value?: number | null;
  /** Avisa a cada mudança, já em centavos (`null` = vazio). */
  onValueChange?: (cents: number | null) => void;
  /** Esconde o prefixo "R$". */
  hidePrefix?: boolean;
  /** Classe do contêiner (o `className` vai para o <input>). */
  wrapperClassName?: string;
};

export function MoneyInput({
  defaultValue,
  value,
  onValueChange,
  hidePrefix = false,
  className,
  wrapperClassName,
  placeholder = "0,00",
  ...rest
}: MoneyInputProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => centsToInput(defaultValue ?? null));
  const text = controlled ? centsToInput(value) : inner;

  return (
    <div className={cn("relative", wrapperClassName)}>
      {!hidePrefix && (
        <span aria-hidden="true" className="text-cinza pointer-events-none absolute inset-y-0 left-3 flex items-center text-base">
          R$
        </span>
      )}
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={cn("input tabular-nums", !hidePrefix && "pl-10", className)}
        value={text}
        onChange={(event) => {
          const next = maskMoney(event.target.value);
          if (!controlled) setInner(next);
          onValueChange?.(moneyToCents(next));
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ telefone
/** Formata progressivamente um telefone brasileiro: `(11) 91234-5678` / `(11) 3456-7890`. */
export function maskPhone(text: string): string {
  let digits = onlyDigits(text);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  if (number.length <= 4) return `(${ddd}) ${number}`;
  const split = number.length === 9 ? 5 : 4;
  return `(${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

/** Posição do cursor logo depois do n-ésimo dígito de `text` (ou no fim, se era o último). */
function caretAfterDigits(text: string, count: number): number {
  if (count >= onlyDigits(text).length) return text.length;
  let position = 0;
  let seen = 0;
  while (position < text.length && seen < count) {
    if (/\d/.test(text[position])) seen++;
    position++;
  }
  return position;
}

export type PhoneInputProps = NativeInput & {
  /** Telefone inicial, com ou sem formatação (aceita também +55…). */
  defaultValue?: string | null;
  /** Modo controlado (texto) — use com `onValueChange`. */
  value?: string;
  /** Avisa a cada mudança com o texto já formatado. */
  onValueChange?: (formatted: string) => void;
};

export function PhoneInput({ defaultValue, value, onValueChange, className, placeholder = "(11) 91234-5678", ...rest }: PhoneInputProps) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => maskPhone(defaultValue ?? ""));
  const text = controlled ? maskPhone(value) : inner;
  const marker = useId();
  /** Posição em que o cursor deve ficar depois que o texto reformatado for para a tela. */
  const pendingCaret = useRef<number | null>(null);

  // Reformatar joga o cursor para o fim; aqui ele volta para logo depois do dígito em que estava.
  // (O campo em edição é sempre o elemento em foco, então não é preciso um ref próprio — o `ref` de quem usa fica livre.)
  useLayoutEffect(() => {
    const position = pendingCaret.current;
    pendingCaret.current = null;
    const el = document.activeElement;
    if (position === null || !(el instanceof HTMLInputElement) || el.dataset.phoneInput !== marker) return;
    el.setSelectionRange(position, position);
  });
  return (
    <input
      {...rest}
      data-phone-input={marker}
      type="tel"
      inputMode="tel"
      autoComplete={rest.autoComplete ?? "tel-national"}
      placeholder={placeholder}
      className={cn("input", className)}
      value={text}
      onChange={(event) => {
        const el = event.target;
        const digitsBefore = onlyDigits(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
        const next = maskPhone(el.value);
        if (!controlled) setInner(next);
        onValueChange?.(next);
        pendingCaret.current = caretAfterDigits(next, digitsBefore);
      }}
    />
  );
}
