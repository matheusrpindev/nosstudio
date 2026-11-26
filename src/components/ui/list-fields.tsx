"use client";

/**
 * Campos de lista para formulários do painel. O valor vai num `<input type="hidden" name=…>` em JSON —
 * no servidor, leia com `jsonField(formData, name)` (src/server/action.ts) e valide com zod.
 *
 * - <StringListField>: lista de textos (`string[]`).
 * - <ObjectListField<T>>: lista de objetos (`T[]`), com os campos de cada item desenhados por `renderItem`.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFieldState } from "./form";

type Row<T> = { key: number; value: T };

/**
 * Estado comum: linhas com chave estável, reordenação, foco depois de mover e anúncio para leitores de tela.
 * `rootId` é o id do contêiner do campo (onde o foco é procurado).
 */
function useRows<T>(rootId: string, defaultValue: readonly T[], onChange?: (items: T[]) => void) {
  const [rows, setRows] = useState<Row<T>[]>(() => defaultValue.map((value, key) => ({ key, value })));
  const [nextKey, setNextKey] = useState(defaultValue.length);
  const [announcement, setAnnouncement] = useState("");
  /** Seletor do elemento que deve receber foco depois do próximo render (`n` força o efeito a rodar de novo). */
  const [focusTarget, setFocusTarget] = useState<{ selector: string; n: number } | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const root = document.getElementById(rootId);
    const target = root?.querySelector<HTMLElement>(focusTarget.selector);
    if (target && !target.hasAttribute("disabled")) target.focus();
    else root?.querySelector<HTMLElement>("[data-list-fallback]")?.focus();
  }, [focusTarget, rootId]);

  const focusAfterRender = (selector: string) => setFocusTarget((current) => ({ selector, n: (current?.n ?? 0) + 1 }));
  const commit = (next: Row<T>[]) => {
    setRows(next);
    onChange?.(next.map((row) => row.value));
  };

  return {
    rows,
    announcement,
    focusAfterRender,
    add(value: T) {
      const key = nextKey;
      setNextKey(key + 1);
      commit([...rows, { key, value }]);
      setAnnouncement(`Item adicionado. ${rows.length + 1} no total.`);
      return key;
    },
    set(key: number, value: T) {
      commit(rows.map((row) => (row.key === key ? { key, value } : row)));
    },
    remove(key: number) {
      const index = rows.findIndex((row) => row.key === key);
      if (index < 0) return;
      const next = rows.filter((row) => row.key !== key);
      commit(next);
      setAnnouncement(`Item ${index + 1} removido. ${next.length} no total.`);
      const neighbor = next[index] ?? next[index - 1];
      focusAfterRender(neighbor ? `[data-row="${neighbor.key}"] [data-act="remove"]` : "[data-list-fallback]");
    },
    move(key: number, direction: -1 | 1) {
      const index = rows.findIndex((row) => row.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      commit(next);
      setAnnouncement(`Item movido para a posição ${target + 1} de ${rows.length}.`);
      // mantém o foco no mesmo botão; na borda da lista ele fica desabilitado, então vai para o botão oposto
      const atEdge = direction === -1 ? target === 0 : target === rows.length - 1;
      const act = atEdge ? (direction === -1 ? "down" : "up") : direction === -1 ? "up" : "down";
      focusAfterRender(`[data-row="${key}"] [data-act="${act}"]`);
    },
  };
}

function RowControls({
  index,
  total,
  itemName,
  onMove,
  onRemove,
  className,
}: {
  index: number;
  total: number;
  itemName: string;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      <button
        type="button"
        data-act="up"
        className="btn btn-ghost btn-icon"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Mover para cima: ${itemName}`}
        title="Mover para cima"
      >
        <ArrowUp aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        data-act="down"
        className="btn btn-ghost btn-icon"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label={`Mover para baixo: ${itemName}`}
        title="Mover para baixo"
      >
        <ArrowDown aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        data-act="remove"
        className="btn btn-danger-ghost btn-icon"
        onClick={onRemove}
        aria-label={`Remover: ${itemName}`}
        title="Remover"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

type CommonProps = {
  /** Nome do campo no FormData (o valor é um JSON). */
  name: string;
  label: string;
  hint?: ReactNode;
  /** Mensagem de erro. Dentro de um <ActionForm> o erro do campo (`fieldErrors[name]`) aparece sozinho. */
  error?: string;
  /** Texto do botão de adicionar. */
  addLabel?: string;
  /** Número máximo de itens. */
  max?: number;
  /** Texto mostrado quando a lista está vazia. */
  emptyLabel?: string;
  className?: string;
};

function Header({ label, count, max, labelId }: { label: string; count: number; max?: number; labelId: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <span id={labelId} className="label mb-0">
        {label}
      </span>
      {max !== undefined && (
        <span className="text-texto-suave text-xs tabular-nums" aria-label={`${count} de ${max} itens`}>
          {count}/{max}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ lista de textos
export type StringListFieldProps = CommonProps & {
  defaultValue?: string[];
  /** Placeholder do campo "novo item". */
  placeholder?: string;
  /** Tamanho máximo de cada item. */
  maxLength?: number;
  onChange?: (items: string[]) => void;
};

export function StringListField({
  name,
  label,
  defaultValue = [],
  placeholder = "Novo item",
  addLabel = "Adicionar",
  max,
  maxLength,
  hint,
  error,
  emptyLabel = "Nenhum item ainda.",
  className,
  onChange,
}: StringListFieldProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const draftId = `${uid}-novo`;
  const [draft, setDraft] = useState("");
  const list = useRows<string>(uid, defaultValue, onChange);
  const formState = useFieldState(name);
  const full = max !== undefined && list.rows.length >= max;
  const message = error ?? formState.error;

  // O que será enviado: itens preenchidos + o texto digitado e ainda não adicionado (para não se perder ao salvar).
  const values = list.rows.map((row) => row.value.trim()).filter(Boolean);
  if (draft.trim() && !full) values.push(draft.trim());

  const addDraft = () => {
    const text = draft.trim();
    if (!text || full) return;
    list.add(text);
    setDraft("");
    list.focusAfterRender("[data-list-fallback]");
  };

  return (
    <div id={uid} role="group" aria-labelledby={labelId} className={className}>
      <Header label={label} count={list.rows.length} max={max} labelId={labelId} />
      <input type="hidden" name={name} value={JSON.stringify(values)} />

      {list.rows.length === 0 ? (
        <p className="text-texto-suave border-borda-forte rounded-campo mb-2 border border-dashed px-3 py-2.5 text-sm">{emptyLabel}</p>
      ) : null}
      <ul className={cn("space-y-2", list.rows.length > 0 && "mb-2")}>
        {list.rows.map((row, index) => {
          const itemName = row.value.trim() || `item ${index + 1}`;
          return (
            <li key={row.key} data-row={row.key} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-texto-suave w-5 shrink-0 text-right text-xs tabular-nums">
                {index + 1}
              </span>
              <input
                className="input ml-1 min-w-0 flex-1"
                value={row.value}
                maxLength={maxLength}
                aria-label={`${label}: item ${index + 1}`}
                onChange={(event) => list.set(row.key, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault(); // Enter não envia o formulário: leva ao campo "novo item"
                    document.getElementById(draftId)?.focus();
                  }
                }}
              />
              <RowControls
                index={index}
                total={list.rows.length}
                itemName={itemName}
                onMove={(direction) => list.move(row.key, direction)}
                onRemove={() => list.remove(row.key)}
              />
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <input
          id={draftId}
          data-list-fallback
          className="input min-w-0 flex-1"
          value={draft}
          placeholder={full ? "Limite de itens atingido" : placeholder}
          maxLength={maxLength}
          disabled={full}
          aria-label={`${label}: novo item`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
        />
        <button type="button" className="btn btn-secondary shrink-0" onClick={addDraft} disabled={full || !draft.trim()}>
          <Plus aria-hidden="true" className="size-4" />
          {addLabel}
        </button>
      </div>

      {message ? (
        <p className="field-error" role="alert">
          {message}
        </p>
      ) : null}
      {hint ? <p className="hint">{hint}</p> : null}
      <span className="sr-only" aria-live="polite">
        {list.announcement}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ lista de objetos
export type ObjectListFieldProps<T> = CommonProps & {
  defaultValue?: T[];
  /** Cria um item novo (vazio). Para ids estáveis, gere aqui (ex.: `crypto.randomUUID()`). */
  createItem: () => T;
  /**
   * Desenha os campos de um item. Chame `update({ campo: valor })` a cada mudança.
   * Os inputs daqui NÃO devem ter `name` (o valor da lista inteira já vai no hidden) — use `aria-label` ou <label>.
   */
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  /** Nome de um item para leitores de tela (ex.: `(item) => item.label`). Padrão: "item N". */
  itemLabel?: (item: T, index: number) => string;
  onChange?: (items: T[]) => void;
};

export function ObjectListField<T>({
  name,
  label,
  defaultValue = [],
  createItem,
  renderItem,
  itemLabel,
  addLabel = "Adicionar item",
  max,
  hint,
  error,
  emptyLabel = "Nenhum item ainda.",
  className,
  onChange,
}: ObjectListFieldProps<T>) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const list = useRows<T>(uid, defaultValue, onChange);
  const formState = useFieldState(name);
  const full = max !== undefined && list.rows.length >= max;
  const message = error ?? formState.error;

  return (
    <div id={uid} role="group" aria-labelledby={labelId} className={className}>
      <Header label={label} count={list.rows.length} max={max} labelId={labelId} />
      <input type="hidden" name={name} value={JSON.stringify(list.rows.map((row) => row.value))} />

      {list.rows.length === 0 ? (
        <p className="text-texto-suave border-borda-forte rounded-campo mb-2 border border-dashed px-3 py-2.5 text-sm">{emptyLabel}</p>
      ) : null}
      <ul className={cn("space-y-2", list.rows.length > 0 && "mb-2")}>
        {list.rows.map((row, index) => {
          const itemName = itemLabel?.(row.value, index)?.trim() || `item ${index + 1}`;
          return (
            <li
              key={row.key}
              data-row={row.key}
              className="border-borda rounded-campo flex flex-col gap-1 border bg-superficie p-2 sm:flex-row sm:items-start sm:gap-2 sm:p-3"
            >
              <div className="min-w-0 flex-1" role="group" aria-label={`${label}: ${itemName}`}>
                {renderItem(row.value, (patch) => list.set(row.key, { ...row.value, ...patch }), index)}
              </div>
              <RowControls
                className="justify-end"
                index={index}
                total={list.rows.length}
                itemName={itemName}
                onMove={(direction) => list.move(row.key, direction)}
                onRemove={() => list.remove(row.key)}
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        data-list-fallback
        className="btn btn-secondary"
        disabled={full}
        onClick={() => {
          const key = list.add(createItem());
          // foco no primeiro campo do item novo
          list.focusAfterRender(`[data-row="${key}"] :is(input, select, textarea):not([type="hidden"])`);
        }}
      >
        <Plus aria-hidden="true" className="size-4" />
        {addLabel}
      </button>
      {full ? <p className="hint">Limite de {max} itens atingido.</p> : null}

      {message ? (
        <p className="field-error" role="alert">
          {message}
        </p>
      ) : null}
      {hint ? <p className="hint">{hint}</p> : null}
      <span className="sr-only" aria-live="polite">
        {list.announcement}
      </span>
    </div>
  );
}
