"use client";

/**
 * <MarkdownField>: textarea de texto rico (markdown leve) com barra mínima e pré-visualização.
 * Envia o texto puro no `name`; no servidor é um campo de texto comum (`f.text()` / `f.optionalText()`),
 * e na tela é renderizado com <Markdown> (src/components/markdown.tsx).
 */
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Bold, Italic, Link2, List } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/cn";
import { useFieldState } from "./form";

export type MarkdownFieldProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  /** Altura inicial do textarea, em linhas. */
  rows?: number;
  /** Texto de ajuda (aparece acima da dica de formatação). */
  hint?: ReactNode;
  /** Mensagem de erro. Dentro de um <ActionForm> o erro do campo (`fieldErrors[name]`) aparece sozinho. */
  error?: string;
  required?: boolean;
  /** Mostra "(opcional)" ao lado do rótulo (como o <Field>). */
  optional?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Id do textarea (por padrão é gerado). */
  id?: string;
  className?: string;
  onChange?: (value: string) => void;
};

type Edit = { value: string; selectionStart: number; selectionEnd: number };

/** Envolve a seleção com um marcador (`**`, `*`). Sem seleção, insere um texto de exemplo já selecionado. */
function wrap(text: string, start: number, end: number, mark: string, sample: string): Edit {
  const selected = text.slice(start, end);
  // já está marcado → remove a marcação
  if (selected && text.slice(start - mark.length, start) === mark && text.slice(end, end + mark.length) === mark) {
    return {
      value: text.slice(0, start - mark.length) + selected + text.slice(end + mark.length),
      selectionStart: start - mark.length,
      selectionEnd: end - mark.length,
    };
  }
  const inner = selected || sample;
  return {
    value: text.slice(0, start) + mark + inner + mark + text.slice(end),
    selectionStart: start + mark.length,
    selectionEnd: start + mark.length + inner.length,
  };
}

/** Transforma as linhas selecionadas em itens de lista (ou desfaz, se todas já forem itens). */
function toggleList(text: string, start: number, end: number): Edit {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const allItems = lines.every((line) => /^\s*[-*] /.test(line));
  const changed = lines.map((line) => (allItems ? line.replace(/^(\s*)[-*] /, "$1") : /^\s*[-*] /.test(line) ? line : `- ${line}`)).join("\n");
  // uma lista precisa de uma linha em branco antes dela
  const before = text.slice(0, lineStart);
  const gap = !allItems && before.trim() !== "" && !before.endsWith("\n\n") ? "\n" : "";
  return {
    value: before + gap + changed + text.slice(lineEnd),
    selectionStart: lineStart + gap.length + (lines.length === 1 ? changed.length : 0),
    selectionEnd: lineStart + gap.length + changed.length,
  };
}

/** Insere um link `[texto](https://)` e deixa o endereço selecionado para digitar por cima. */
function insertLink(text: string, start: number, end: number): Edit {
  const selected = text.slice(start, end);
  const isUrl = /^https?:\/\/\S+$/i.test(selected);
  const label = isUrl ? "texto do link" : selected || "texto do link";
  const url = isUrl ? selected : "https://";
  const value = `${text.slice(0, start)}[${label}](${url})${text.slice(end)}`;
  if (isUrl) return { value, selectionStart: start + 1, selectionEnd: start + 1 + label.length };
  const urlStart = start + label.length + 3;
  return { value, selectionStart: urlStart, selectionEnd: urlStart + url.length };
}

type ToolId = "bold" | "italic" | "list" | "link";
const TOOLS: { id: ToolId; label: string; shortcut?: string; icon: typeof Bold }[] = [
  { id: "bold", label: "Negrito", shortcut: "Ctrl+B", icon: Bold },
  { id: "italic", label: "Itálico", shortcut: "Ctrl+I", icon: Italic },
  { id: "list", label: "Lista", icon: List },
  { id: "link", label: "Link", shortcut: "Ctrl+K", icon: Link2 },
];
const SHORTCUTS: Record<string, ToolId | undefined> = { b: "bold", i: "italic", k: "link" };

export function MarkdownField({
  name,
  label,
  defaultValue,
  rows = 6,
  hint,
  error: errorProp,
  required,
  optional,
  placeholder,
  maxLength,
  id,
  className,
  onChange,
}: MarkdownFieldProps) {
  const formError = useFieldState(name).error;
  const error = errorProp ?? formError;
  const uid = useId();
  const fieldId = id ?? `${uid}-campo`;
  const hintId = `${uid}-dica`;
  const errorId = `${uid}-erro`;
  const panelId = `${uid}-previa`;
  const [value, setValue] = useState(defaultValue ?? "");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    const el = textareaRef.current;
    if (!selection || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(selection[0], selection[1]);
  });

  const update = (next: string) => {
    setValue(next);
    onChange?.(next);
  };

  const apply = (edit: (text: string, start: number, end: number) => Edit) => {
    const el = textareaRef.current;
    if (!el) return;
    const result = edit(el.value, el.selectionStart, el.selectionEnd);
    pendingSelection.current = [result.selectionStart, result.selectionEnd];
    update(maxLength ? result.value.slice(0, maxLength) : result.value);
  };

  const run = (tool: ToolId) => {
    if (tool === "bold") apply((t, s, e) => wrap(t, s, e, "**", "texto em negrito"));
    else if (tool === "italic") apply((t, s, e) => wrap(t, s, e, "*", "texto em itálico"));
    else if (tool === "list") apply(toggleList);
    else apply(insertLink);
  };

  const tabClass = (active: boolean) =>
    cn(
      "min-h-11 sm:min-h-9 cursor-pointer rounded-md px-3 text-[0.8125rem] font-semibold transition-colors",
      active ? "text-roxo bg-white shadow-sm" : "text-cinza hover:text-grafite",
    );

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="label">
        {label}
        {optional ? <span className="text-cinza font-normal"> (opcional)</span> : null}
      </label>

      <div
        className={cn(
          "rounded-campo focus-within:border-roxo focus-within:ring-roxo/20 overflow-hidden border bg-white transition-colors focus-within:ring-4",
          error ? "border-perigo" : "border-areia-escuro",
        )}
      >
        <div className="border-areia bg-offwhite flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b px-1.5 py-1">
          <div role="toolbar" aria-label={`Formatação de ${label}`} className="flex items-center">
            {TOOLS.map((tool) => (
              <button
                key={tool.label}
                type="button"
                className="btn btn-ghost btn-icon text-grafite hover:text-roxo"
                disabled={mode === "preview"}
                onClick={() => run(tool.id)}
                aria-label={tool.label}
                title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
              >
                <tool.icon aria-hidden="true" className="size-4" />
              </button>
            ))}
          </div>
          <div role="group" aria-label="Modo de edição" className="bg-areia/70 flex gap-0.5 rounded-lg p-0.5">
            <button type="button" className={tabClass(mode === "write")} aria-pressed={mode === "write"} onClick={() => setMode("write")}>
              Escrever
            </button>
            <button
              type="button"
              className={tabClass(mode === "preview")}
              aria-pressed={mode === "preview"}
              aria-controls={panelId}
              onClick={() => setMode("preview")}
            >
              Pré-visualizar
            </button>
          </div>
        </div>

        {/* O textarea continua no DOM durante a prévia (só fica oculto), então o valor é sempre enviado. */}
        <textarea
          ref={textareaRef}
          id={fieldId}
          name={name}
          rows={rows}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          hidden={mode === "preview"}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
          className="text-grafite placeholder:text-cinza/70 block min-h-24 w-full resize-y border-0 bg-white px-3 py-2.5 text-base leading-relaxed outline-none"
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            const key = event.key.toLowerCase();
            const tool = SHORTCUTS[key];
            if (!tool) return;
            event.preventDefault();
            run(tool);
          }}
        />
        {mode === "preview" ? (
          <div
            id={panelId}
            role="region"
            aria-label={`Pré-visualização de ${label}`}
            tabIndex={0}
            className="px-3 py-2.5"
            style={{ minHeight: `${rows * 1.625 + 1.25}rem` }}
          >
            {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-cinza text-sm">Nada para pré-visualizar ainda.</p>}
          </div>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div id={hintId}>
        {hint ? <p className="hint">{hint}</p> : null}
        <p className="hint">
          Formatação: <code className="text-grafite">**negrito**</code>, <code className="text-grafite">*itálico*</code>,{" "}
          <code className="text-grafite">- item de lista</code>, <code className="text-grafite">[texto](https://link)</code>. Linha em
          branco separa parágrafos.
        </p>
      </div>
    </div>
  );
}
