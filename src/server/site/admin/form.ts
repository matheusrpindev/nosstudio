/**
 * Leitura de formulários das coleções do site: igual a `parseForm`, mas também lê campos JSON (listas,
 * galerias) e devolve os valores digitados no caso de sucesso — para repopular o formulário quando um erro
 * só aparece depois da validação (ex.: slug já usado).
 */
import "server-only";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { formToObject, jsonField, parseInput } from "@/server/action";
import { safeUrl, videoEmbedUrl } from "@/lib/format";

type Parsed<T> = { ok: true; data: T; values: Record<string, string> } | { ok: false; state: ActionState<never> };

export function parseSiteForm<S extends z.ZodType>(schema: S, formData: FormData, jsonFields: readonly string[] = []): Parsed<z.infer<S>> {
  const object: Record<string, unknown> = formToObject(formData);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) if (typeof value === "string") values[key] = value;
  for (const name of jsonFields) object[name] = jsonField(formData, name) ?? [];
  const parsed = parseInput(schema, object, values);
  return parsed.ok ? { ok: true, data: parsed.data, values } : parsed;
}

/** Erro de um campo específico, com os valores digitados para não perder o que a pessoa escreveu. */
export function fieldError(field: string, message: string, values: Record<string, string>): ActionState {
  return actionError("Confira os campos destacados.", { fieldErrors: { [field]: message }, values });
}

// ------------------------------------------------------------ campos comuns
/** Slug digitado: minúsculas, números e hífens. Vazio = o servidor gera a partir do título. */
export const slugField = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(80, "Máximo de 80 caracteres.")
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => v === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), "Use só letras minúsculas, números e hífens (ex.: video-e-producao).");

/** Link de vídeo (YouTube/Vimeo) opcional. Vazio vira `null`; o valor salvo é a URL normalizada. */
export const videoField = () =>
  z
    .string()
    .trim()
    .max(300, "Máximo de 300 caracteres.")
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || videoEmbedUrl(v) !== null, "Use um link do YouTube ou do Vimeo (ex.: https://youtu.be/…).")
    .transform((v) => (v === null ? null : safeUrl(v)));

export const idListField = (max: number) => z.array(z.number().int().positive()).max(max, `No máximo ${max} imagens.`);
export const textListField = (maxItems: number, maxLength: number) => z.array(z.string().trim().min(1).max(maxLength, `Máximo de ${maxLength} caracteres por item.`)).max(maxItems, `No máximo ${maxItems} itens.`);
