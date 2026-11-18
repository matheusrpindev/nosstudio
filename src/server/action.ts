/**
 * Utilitários para Server Actions do painel.
 *
 * Padrão de uma action de formulário (use com `useActionState`):
 *
 *   "use server";
 *   export async function saveThingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
 *     const user = await requireUser();                       // 1. autorização SEMPRE primeiro
 *     const parsed = parseForm(thingSchema, formData);        // 2. validação (zod)
 *     if (!parsed.ok) return parsed.state;
 *     await db.insert(things).values(parsed.data);            // 3. mutação
 *     await logAudit({ user, action: "create", entity: "thing", summary: "…" });   // 4. auditoria
 *     invalidateSite();   // só se a mudança aparece no site público
 *     refresh();          // atualiza a tela atual do painel (ou redirect("/painel/…"))
 *     return actionOk("Salvo.");
 *   }
 */
import "server-only";
import { z } from "zod";
import { actionError, type ActionState } from "@/lib/action-state";
import { isISODate, isTime } from "@/lib/dates";
import { isValidEmail, parseBRL } from "@/lib/format";

/** FormData → objeto simples. Chaves repetidas (ou terminadas em `[]`) viram array. Arquivos são ignorados. */
export function formToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const [rawKey, value] of formData.entries()) {
    if (typeof value !== "string" || rawKey.startsWith("$ACTION")) continue;
    const isList = rawKey.endsWith("[]");
    const key = isList ? rawKey.slice(0, -2) : rawKey;
    const current = result[key];
    if (isList || current !== undefined) {
      result[key] = [...(Array.isArray(current) ? current : current !== undefined ? [current] : []), value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Primeiro erro de cada campo, com caminho em notação de ponto (`items.0.title`). */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; state: ActionState<never> };

/** Valida um objeto qualquer com zod e devolve o estado de erro pronto para o formulário. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown, values?: Record<string, string>): ParseResult<z.infer<S>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors = zodFieldErrors(parsed.error);
  return {
    ok: false,
    state: actionError(fieldErrors._form ?? "Confira os campos destacados.", { fieldErrors, values }),
  };
}

/** Valida um FormData com zod (via `formToObject`). Devolve também os valores digitados para repopular o formulário. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): ParseResult<z.infer<S>> {
  const object = formToObject(formData);
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(object)) if (typeof value === "string") values[key] = value;
  return parseInput(schema, object, values);
}

/**
 * Lê um campo JSON de formulário (listas editadas no cliente e enviadas num `<input type="hidden">`).
 * Devolve `undefined` se o JSON for inválido — o schema zod acusa o erro.
 */
export function jsonField(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// --------------------------------------------- tipos de campo reutilizáveis
/** Campos comuns de formulário já normalizados. Use nos schemas das actions. */
export const f = {
  /** Texto obrigatório. */
  text: (max = 200, message = "Preencha este campo.") => z.string().trim().min(1, message).max(max, `Máximo de ${max} caracteres.`),
  /** Texto opcional (vazio vira ""). */
  optionalText: (max = 2000) =>
    z
      .string()
      .trim()
      .max(max, `Máximo de ${max} caracteres.`)
      .optional()
      .transform((v) => v ?? ""),
  /** Checkbox/switch: "on" | "true" | "1" → true. Ausente → false. */
  checkbox: () =>
    z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "on" || v === "true" || v === "1"),
  /** Data `YYYY-MM-DD` obrigatória. */
  date: (message = "Informe uma data válida.") => z.string().refine(isISODate, message),
  /** Data opcional: vazio vira `null`. */
  optionalDate: () =>
    z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isISODate(v), "Data inválida."),
  /** Horário `HH:mm` opcional: vazio vira `null`. */
  optionalTime: () =>
    z
      .string()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || isTime(v), "Horário inválido."),
  /** Valor em reais digitado pelo usuário → centavos (obrigatório, ≥ 0). */
  money: (message = "Informe um valor válido.") =>
    z
      .string()
      .transform((v) => parseBRL(v))
      .refine((v): v is number => v !== null && v >= 0, message),
  /** Valor em reais opcional: vazio vira `null`. */
  optionalMoney: () =>
    z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? parseBRL(v) : null))
      .refine((v) => v === null || v >= 0, "Valor inválido."),
  /** Id numérico vindo de select/hidden. */
  id: (message = "Selecione uma opção.") => z.coerce.number().int().positive(message),
  /** Id opcional: vazio vira `null`. */
  optionalId: () =>
    z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Opção inválida."),
  /** Número decimal digitado com vírgula ou ponto. */
  number: (message = "Informe um número.") =>
    z
      .string()
      .transform((v) => {
        const s = v.trim();
        if (!s) return Number.NaN;
        // com vírgula, os pontos são separadores de milhar ("1.234,5"); sem vírgula, o ponto é decimal ("1.5")
        return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
      })
      .refine((v) => Number.isFinite(v), message),
  /** E-mail opcional (vazio vira ""). */
  optionalEmail: () =>
    z
      .string()
      .trim()
      .toLowerCase()
      .max(160)
      .optional()
      .transform((v) => v ?? "")
      .refine((v) => v === "" || isValidEmail(v), "E-mail inválido."),
};
