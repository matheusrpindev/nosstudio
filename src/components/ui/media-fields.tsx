"use client";

/**
 * Campos de upload do painel. Enviam o arquivo para POST /painel/api/media assim que ele é escolhido e guardam
 * só o ID no formulário (`<input type="hidden" name=…>`):
 *
 * - <ImageField>   → id da imagem (ou "")            → no servidor: `f.optionalId()`
 * - <GalleryField> → JSON com os ids, na ordem        → `jsonField(formData, name)` + `z.array(z.number().int().positive())`
 * - <FileField>    → id do arquivo privado (ou "")    → `f.optionalId()`
 *
 * Para preencher `defaultValue`, use `getMediaValue(id)` / `getMediaValues(ids)` de `@/server/media`.
 * Remover do campo NÃO apaga o arquivo no servidor: só desvincula (vale ao salvar o formulário).
 */
import { useEffect, useEffectEvent, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, FileText, ImagePlus, Paperclip, RefreshCw, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { useFieldState } from "./form";

export type MediaValue = {
  id: number;
  url: string;
  mime: string;
  originalName: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  visibility: "public" | "private";
};

const MEDIA_ENDPOINT = "/painel/api/media";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/gif";
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif";
const FILE_MAX_BYTES = 25 * 1024 * 1024;
const ALT_MAX = 300;
const WAIT_MESSAGE = "Aguarde o envio do arquivo terminar antes de salvar.";
const CONNECTION_ERROR = "Falha de conexão ao enviar. Confira a internet e tente de novo.";

/** `1,2 MB`, `340 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

function readError(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) return body.error;
  return fallback;
}

/** Envia um arquivo para a API do painel, com progresso (0–1). Rejeita com `Error(mensagem pt-BR)`. */
export function uploadMedia(
  file: File,
  options: { visibility: "public" | "private"; alt?: string; onProgress?: (fraction: number) => void },
): Promise<MediaValue> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append("file", file);
    data.append("visibility", options.visibility);
    if (options.alt) data.append("alt", options.alt);

    const request = new XMLHttpRequest();
    request.open("POST", MEDIA_ENDPOINT);
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    request.onerror = () => reject(new Error(CONNECTION_ERROR));
    request.onabort = () => reject(new Error("Envio cancelado."));
    request.onload = () => {
      const body: unknown = request.response;
      const media = body && typeof body === "object" && "media" in body ? (body.media as MediaValue | undefined) : undefined;
      if (request.status >= 200 && request.status < 300 && media && typeof media.id === "number") resolve(media);
      else reject(new Error(readError(body, request.status === 413 ? "Arquivo grande demais." : "Não foi possível enviar o arquivo. Tente de novo.")));
    };
    request.send(data);
  });
}

/** Salva o texto alternativo de um arquivo já enviado. */
export async function saveMediaAlt(id: number, alt: string): Promise<MediaValue> {
  let response: Response;
  try {
    response = await fetch(`${MEDIA_ENDPOINT}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt }),
    });
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || !("media" in body)) {
    throw new Error(readError(body, "Não foi possível salvar o texto alternativo."));
  }
  return body.media as MediaValue;
}

// ------------------------------------------------------------------ peças internas
type UploadState = { name: string; progress: number; current?: number; total?: number } | null;

function checkSize(file: File, max: number, what: string): string | null {
  return file.size > max ? `${what} grande demais: "${file.name}" tem ${formatBytes(file.size)} (máximo de ${formatBytes(max)}).` : null;
}

/**
 * Enquanto um envio está em andamento, segura o envio do formulário em volta (senão ele seria salvo sem o arquivo).
 * O ouvinte nativo cancela o `submit` antes de o React disparar a Server Action.
 */
function UploadGuard({ active, onBlocked }: { active: boolean; onBlocked: () => void }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const notify = useEffectEvent(onBlocked);
  useEffect(() => {
    const form = active ? ref.current?.closest("form") : null;
    if (!form) return;
    const block = (event: SubmitEvent) => {
      event.preventDefault();
      event.stopPropagation();
      notify();
    };
    form.addEventListener("submit", block, true);
    return () => form.removeEventListener("submit", block, true);
  }, [active]);
  return <span ref={ref} hidden />;
}

function ProgressBar({ upload }: { upload: NonNullable<UploadState> }) {
  const percent = Math.round(upload.progress * 100);
  const prefix = upload.total && upload.total > 1 ? `Enviando ${upload.current} de ${upload.total}` : "Enviando";
  return (
    <div className="w-full">
      <p className="text-grafite mb-1.5 flex justify-between gap-3 text-sm font-medium">
        <span className="min-w-0 truncate">
          {prefix}: {upload.name}
        </span>
        <span className="tabular-nums">{percent}%</span>
      </p>
      <div
        role="progressbar"
        aria-label={`${prefix}: ${upload.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-lavanda-claro h-2 overflow-hidden rounded-full"
      >
        <div className="bg-roxo h-full rounded-full transition-[width]" style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
    </div>
  );
}

function Messages({ name, hint, error: errorProp, uploadError, hintId }: { name: string; hint?: ReactNode; error?: string; uploadError: string | null; hintId: string }) {
  const formError = useFieldState(name).error;
  const error = errorProp ?? formError;
  return (
    <>
      {hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {uploadError ? (
        <p className="field-error" role="alert">
          {uploadError}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Área de soltar arquivos + botão de escolher. O <input type="file"> fica oculto; o botão é o controle acessível. */
function DropZone({
  accept,
  multiple,
  disabled,
  onFiles,
  icon,
  buttonLabel,
  description,
  upload,
  describedBy,
  className,
  style,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  icon: ReactNode;
  buttonLabel: string;
  description: string;
  upload: UploadState;
  describedBy?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const busy = upload !== null;

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (disabled || busy) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      data-dropzone
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled && !busy) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      style={style}
      className={cn(
        "rounded-campo flex flex-col items-center justify-center gap-2 border border-dashed px-4 py-5 text-center transition-colors",
        over ? "border-roxo bg-lavanda-claro" : "border-areia-escuro bg-offwhite/50",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        tabIndex={-1}
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ""; // permite escolher o mesmo arquivo de novo
          if (files.length > 0) onFiles(files);
        }}
      />
      {busy ? (
        <ProgressBar upload={upload} />
      ) : (
        <>
          <span aria-hidden="true" className="text-roxo">
            {icon}
          </span>
          <button
            type="button"
            data-pick
            className="btn btn-secondary"
            disabled={disabled}
            aria-describedby={describedBy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden="true" className="size-4" />
            {buttonLabel}
          </button>
          <p className="text-cinza text-[0.8125rem] leading-snug">{description}</p>
        </>
      )}
    </div>
  );
}

/** Campo de texto alternativo: salva com PATCH ao sair do campo. */
function AltInput({ media, onSaved, srSuffix, compact }: { media: MediaValue; onSaved: (media: MediaValue) => void; srSuffix?: string; compact?: boolean }) {
  const id = useId();
  const [text, setText] = useState(media.alt);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  const save = async () => {
    const next = text.trim();
    if (next === media.alt.trim()) return;
    setStatus({ kind: "saving" });
    try {
      const saved = await saveMediaAlt(media.id, next);
      onSaved({ ...media, alt: saved.alt });
      setText(saved.alt);
      setStatus({ kind: "saved" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Não foi possível salvar o texto alternativo." });
    }
  };

  return (
    <div>
      <label htmlFor={id} className={cn("label", compact && "mb-1 text-[0.8125rem]")}>
        Texto alternativo
        {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
      </label>
      <input
        id={id}
        className="input"
        value={text}
        maxLength={ALT_MAX}
        placeholder="Descreva a imagem"
        aria-describedby={`${id}-status`}
        aria-invalid={status.kind === "error" ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (status.kind !== "idle") setStatus({ kind: "idle" });
        }}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault(); // Enter salva o texto em vez de enviar o formulário
            void save();
          }
        }}
      />
      <p id={`${id}-status`} aria-live="polite" className={cn(status.kind === "error" ? "field-error" : "hint", compact && "mt-1")}>
        {status.kind === "saving"
          ? "Salvando…"
          : status.kind === "saved"
            ? "Texto alternativo salvo."
            : status.kind === "error"
              ? status.message
              : compact
                ? "Para quem não vê a imagem."
                : "Descreve a imagem para quem não pode vê-la (leitores de tela e buscadores). Salva ao sair do campo."}
      </p>
    </div>
  );
}

function useUploader() {
  const [upload, setUpload] = useState<UploadState>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  return { upload, setUpload, uploadError, setUploadError };
}

type FieldProps = {
  /** Nome do campo no FormData. */
  name: string;
  label: string;
  hint?: ReactNode;
  /** Mensagem de erro. Dentro de um <ActionForm> o erro do campo (`fieldErrors[name]`) aparece sozinho. */
  error?: string;
  className?: string;
};

// ------------------------------------------------------------------ imagem única
export type ImageFieldProps = FieldProps & {
  defaultValue?: MediaValue | null;
  /** Proporção da prévia, no formato CSS: "16/9" (padrão), "1/1", "4/5", "3/2"… */
  aspect?: string;
  onChange?: (media: MediaValue | null) => void;
};

export function ImageField({ name, label, defaultValue = null, hint, error, aspect = "16/9", className, onChange }: ImageFieldProps) {
  const uid = useId();
  const [media, setMedia] = useState<MediaValue | null>(defaultValue);
  const [replacing, setReplacing] = useState(false);
  const { upload, setUpload, uploadError, setUploadError } = useUploader();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const change = (next: MediaValue | null) => {
    setMedia(next);
    onChange?.(next);
  };

  const send = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const tooBig = checkSize(file, IMAGE_MAX_BYTES, "Imagem");
    if (tooBig) return setUploadError(tooBig);
    setUploadError(null);
    setUpload({ name: file.name, progress: 0 });
    try {
      const uploaded = await uploadMedia(file, { visibility: "public", onProgress: (progress) => setUpload({ name: file.name, progress }) });
      change(uploaded);
      setReplacing(false);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : CONNECTION_ERROR);
    } finally {
      setUpload(null);
    }
  };

  const showDropZone = !media || replacing || upload !== null;

  return (
    <div ref={rootRef} role="group" aria-labelledby={`${uid}-label`} className={className}>
      <span id={`${uid}-label`} className="label">
        {label}
      </span>
      <input type="hidden" name={name} value={media?.id ?? ""} />
      <UploadGuard active={upload !== null} onBlocked={() => setUploadError(WAIT_MESSAGE)} />

      {media && !showDropZone ? (
        <div className="border-areia rounded-campo grid gap-3 border bg-white p-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
          <div className="bg-lavanda-claro overflow-hidden rounded-md" style={{ aspectRatio: aspect }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- prévia do painel; o arquivo já vem otimizado pelo upload */}
            <img src={media.url} alt={media.alt || `Prévia: ${media.originalName}`} className="size-full object-cover" />
          </div>
          <div className="min-w-0">
            <AltInput key={media.id} media={media} onSaved={change} />
            <p className="text-cinza mt-2 truncate text-xs" title={media.originalName}>
              {media.originalName}
              {media.width && media.height ? ` · ${media.width}×${media.height}` : ""} · {formatBytes(media.size)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm min-h-11 sm:min-h-9" onClick={() => setReplacing(true)}>
                <RefreshCw aria-hidden="true" className="size-4" />
                Trocar
              </button>
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm min-h-11 sm:min-h-9"
                onClick={() => {
                  change(null);
                  setUploadError(null);
                  requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-pick]")?.focus());
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <DropZone
            accept={IMAGE_ACCEPT}
            onFiles={send}
            upload={upload}
            icon={<ImagePlus className="size-7" />}
            buttonLabel={media ? "Escolher outra imagem" : "Escolher imagem"}
            description="ou arraste a imagem para cá · JPG, PNG, WebP, AVIF ou GIF, até 15 MB"
            describedBy={hint ? `${uid}-hint` : undefined}
            className="min-h-36"
          />
          {media && replacing && upload === null ? (
            <button type="button" className="btn btn-ghost btn-sm mt-2 min-h-11 sm:min-h-9" onClick={() => setReplacing(false)}>
              Cancelar e manter a imagem atual
            </button>
          ) : null}
        </>
      )}

      <Messages name={name} hint={hint} error={error} uploadError={uploadError} hintId={`${uid}-hint`} />
    </div>
  );
}

// ------------------------------------------------------------------ galeria
export type GalleryFieldProps = FieldProps & {
  defaultValue?: MediaValue[];
  /** Número máximo de imagens. */
  max?: number;
  onChange?: (media: MediaValue[]) => void;
};

export function GalleryField({ name, label, defaultValue = [], max, hint, error, className, onChange }: GalleryFieldProps) {
  const uid = useId();
  const [items, setItems] = useState<MediaValue[]>(defaultValue);
  const [announcement, setAnnouncement] = useState("");
  const { upload, setUpload, uploadError, setUploadError } = useUploader();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
    const selector = pendingFocus.current;
    if (!selector) return;
    pendingFocus.current = null;
    const target = rootRef.current?.querySelector<HTMLElement>(selector);
    if (target && !target.hasAttribute("disabled")) target.focus();
    else rootRef.current?.querySelector<HTMLElement>("[data-pick]")?.focus();
  });

  const change = (next: MediaValue[]) => {
    itemsRef.current = next;
    setItems(next);
    onChange?.(next);
  };

  const remaining = max === undefined ? Infinity : Math.max(0, max - items.length);

  const send = async (files: File[]) => {
    setUploadError(null);
    const errors: string[] = [];
    let queue = files;
    if (queue.length > remaining) {
      errors.push(`Só cabem mais ${remaining} ${remaining === 1 ? "imagem" : "imagens"} (máximo de ${max}).`);
      queue = queue.slice(0, remaining);
    }
    for (const [index, file] of queue.entries()) {
      const tooBig = checkSize(file, IMAGE_MAX_BYTES, "Imagem");
      if (tooBig) {
        errors.push(tooBig);
        continue;
      }
      const step = { name: file.name, current: index + 1, total: queue.length };
      setUpload({ ...step, progress: 0 });
      try {
        const uploaded = await uploadMedia(file, { visibility: "public", onProgress: (progress) => setUpload({ ...step, progress }) });
        change([...itemsRef.current, uploaded]);
      } catch (reason) {
        errors.push(`${file.name}: ${reason instanceof Error ? reason.message : CONNECTION_ERROR}`);
      }
    }
    setUpload(null);
    if (errors.length > 0) setUploadError(errors.join(" "));
  };

  const move = (id: number, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
    setAnnouncement(`Imagem movida para a posição ${target + 1} de ${items.length}.`);
    const atEdge = direction === -1 ? target === 0 : target === items.length - 1;
    const act = atEdge ? (direction === -1 ? "next" : "prev") : direction === -1 ? "prev" : "next";
    pendingFocus.current = `[data-media="${id}"] [data-act="${act}"]`;
  };

  const remove = (id: number) => {
    const index = items.findIndex((item) => item.id === id);
    const next = items.filter((item) => item.id !== id);
    change(next);
    setAnnouncement(`Imagem ${index + 1} removida. ${next.length} no total.`);
    const neighbor = next[index] ?? next[index - 1];
    pendingFocus.current = neighbor ? `[data-media="${neighbor.id}"] [data-act="remove"]` : "[data-pick]";
  };

  return (
    <div ref={rootRef} role="group" aria-labelledby={`${uid}-label`} className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span id={`${uid}-label`} className="label mb-0">
          {label}
        </span>
        <span className="text-cinza text-xs tabular-nums">
          {max !== undefined ? `${items.length}/${max}` : `${items.length} ${items.length === 1 ? "imagem" : "imagens"}`}
        </span>
      </div>
      <input type="hidden" name={name} value={JSON.stringify(items.map((item) => item.id))} />
      <UploadGuard active={upload !== null} onBlocked={() => setUploadError(WAIT_MESSAGE)} />

      {items.length > 0 ? (
        <ul className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((item, index) => {
            const itemName = item.alt.trim() || `imagem ${index + 1}`;
            return (
              <li key={item.id} data-media={item.id} className="border-areia rounded-campo flex flex-col border bg-white p-2">
                <div className="bg-lavanda-claro relative aspect-[4/3] overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do painel */}
                  <img src={item.url} alt={item.alt || `Imagem ${index + 1}: ${item.originalName}`} loading="lazy" className="size-full object-cover" />
                  <span aria-hidden="true" className="bg-grafite/75 absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                    {index + 1}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <div className="flex">
                    <button
                      type="button"
                      data-act="prev"
                      className="btn btn-ghost btn-icon"
                      disabled={index === 0}
                      onClick={() => move(item.id, -1)}
                      aria-label={`Mover para antes: ${itemName}`}
                      title="Mover para antes"
                    >
                      <ArrowLeft aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      data-act="next"
                      className="btn btn-ghost btn-icon"
                      disabled={index === items.length - 1}
                      onClick={() => move(item.id, 1)}
                      aria-label={`Mover para depois: ${itemName}`}
                      title="Mover para depois"
                    >
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    data-act="remove"
                    className="btn btn-danger-ghost btn-icon"
                    onClick={() => remove(item.id)}
                    aria-label={`Remover: ${itemName}`}
                    title="Remover da galeria"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <AltInput
                  compact
                  media={item}
                  srSuffix={`da imagem ${index + 1}`}
                  onSaved={(saved) => change(itemsRef.current.map((current) => (current.id === saved.id ? saved : current)))}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {remaining > 0 || upload !== null ? (
        <DropZone
          accept={IMAGE_ACCEPT}
          multiple
          onFiles={send}
          upload={upload}
          icon={<ImagePlus className="size-7" />}
          buttonLabel={items.length > 0 ? "Adicionar imagens" : "Escolher imagens"}
          description="ou arraste para cá · JPG, PNG, WebP, AVIF ou GIF, até 15 MB cada"
          describedBy={hint ? `${uid}-hint` : undefined}
        />
      ) : (
        <p className="hint">Limite de {max} imagens atingido. Remova uma para adicionar outra.</p>
      )}

      <Messages name={name} hint={hint} error={error} uploadError={uploadError} hintId={`${uid}-hint`} />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------ arquivo privado
export type FileFieldProps = FieldProps & {
  defaultValue?: MediaValue | null;
  /** Tipos aceitos pelo seletor de arquivos (atributo `accept`). Padrão: documentos, planilhas, PDF, imagens, zip. */
  accept?: string;
  onChange?: (media: MediaValue | null) => void;
};

export function FileField({ name, label, defaultValue = null, accept = FILE_ACCEPT, hint, error, className, onChange }: FileFieldProps) {
  const uid = useId();
  const [media, setMedia] = useState<MediaValue | null>(defaultValue);
  const [replacing, setReplacing] = useState(false);
  const { upload, setUpload, uploadError, setUploadError } = useUploader();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const change = (next: MediaValue | null) => {
    setMedia(next);
    onChange?.(next);
  };

  const send = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const tooBig = checkSize(file, FILE_MAX_BYTES, "Arquivo");
    if (tooBig) return setUploadError(tooBig);
    setUploadError(null);
    setUpload({ name: file.name, progress: 0 });
    try {
      const uploaded = await uploadMedia(file, { visibility: "private", onProgress: (progress) => setUpload({ name: file.name, progress }) });
      change(uploaded);
      setReplacing(false);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : CONNECTION_ERROR);
    } finally {
      setUpload(null);
    }
  };

  const showDropZone = !media || replacing || upload !== null;
  const inline = media ? media.mime === "application/pdf" || media.mime.startsWith("image/") : false;

  return (
    <div ref={rootRef} role="group" aria-labelledby={`${uid}-label`} className={className}>
      <span id={`${uid}-label`} className="label">
        {label}
      </span>
      <input type="hidden" name={name} value={media?.id ?? ""} />
      <UploadGuard active={upload !== null} onBlocked={() => setUploadError(WAIT_MESSAGE)} />

      {media && !showDropZone ? (
        <div className="border-areia rounded-campo flex flex-col gap-2 border bg-white p-3 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span aria-hidden="true" className="bg-lavanda-claro text-roxo flex size-11 shrink-0 items-center justify-center rounded-md">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0">
              <a
                href={inline ? `${media.url}?inline=1` : media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link flex min-h-6 items-center gap-1.5 text-sm"
                title={media.originalName}
              >
                <span className="truncate">{media.originalName}</span>
                <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">({inline ? "abre em nova aba" : "baixa o arquivo"})</span>
              </a>
              <p className="text-cinza text-xs">
                {formatBytes(media.size)} · arquivo privado (só com login no painel)
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" className="btn btn-secondary btn-sm min-h-11 sm:min-h-9" onClick={() => setReplacing(true)}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Trocar
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm min-h-11 sm:min-h-9"
              onClick={() => {
                change(null);
                setUploadError(null);
                requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>("[data-pick]")?.focus());
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remover
            </button>
          </div>
        </div>
      ) : (
        <>
          <DropZone
            accept={accept}
            onFiles={send}
            upload={upload}
            icon={<Paperclip className="size-6" />}
            buttonLabel={media ? "Escolher outro arquivo" : "Escolher arquivo"}
            description="ou arraste o arquivo para cá · até 25 MB"
            describedBy={hint ? `${uid}-hint` : undefined}
          />
          {media && replacing && upload === null ? (
            <button type="button" className="btn btn-ghost btn-sm mt-2 min-h-11 sm:min-h-9" onClick={() => setReplacing(false)}>
              Cancelar e manter o arquivo atual
            </button>
          ) : null}
        </>
      )}

      <Messages name={name} hint={hint} error={error} uploadError={uploadError} hintId={`${uid}-hint`} />
    </div>
  );
}
