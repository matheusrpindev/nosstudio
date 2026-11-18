/**
 * Formulário do editor de textos → objeto da seção, validado.
 *
 * Os campos são nomeados pelo caminho com pontos (`hero.primaryCta.label`); listas e imagens vão como JSON /
 * id em campos ocultos. A estrutura vem do mapa em `config.ts`, então um único código serve às 12 seções.
 * Arquivo puro (sem banco): testado em `build.test.ts`.
 */
import { isValidPhone, safeHref } from "@/lib/format";
import { siteContentSchemas, type SiteContentKey } from "@/lib/site/content";
import { SITE_SECTIONS, type ListField, type SectionConfig } from "./config";

export type ParsedSection =
  | { ok: true; data: Record<string, unknown>; mediaIds: number[] }
  | { ok: false; errors: Record<string, string>; values: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const REQUIRED = "Preencha este campo.";
const HREF_ERROR = "Link inválido. Para uma página do site comece com / (ex.: /contato); para outro site use https://…";

// ---------------------------------------------------------------- normalização
/** Link interno (`/contato`, `#faq`) ou externo (`https://…`, `instagram.com/x`). Devolve `null` se inválido. */
export function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  if (/^\/(?!\/)/.test(value) || value.startsWith("#")) return /\s/.test(value) ? null : value;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  // sem esquema, só aceita algo que pareça um endereço ("exemplo.com.br"), não uma palavra solta
  if (!hasScheme && !/^[^\s/]+\.[^\s/]{2,}/.test(value)) return null;
  const safe = safeHref(value);
  if (!safe) return null;
  return /^https?:\/\//i.test(value) ? value : safe;
}

/** `@perfil`, `perfil` ou link do Instagram → `@perfil`. */
export function normalizeInstagram(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  const handle = value
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
  return HANDLE_RE.test(handle) ? `@${handle}` : null;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next === "object" && next !== null && !Array.isArray(next)) node = next as Record<string, unknown>;
    else node = node[part] = {};
  }
  node[parts[parts.length - 1]] = value;
}

function readId(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

// ------------------------------------------------------------------- lista
function buildList(field: ListField, raw: string, errors: Record<string, string>, mediaIds: number[]): unknown[] {
  let parsed: unknown = [];
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      errors[field.path] = "Não foi possível ler esta lista. Recarregue a página e tente de novo.";
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    errors[field.path] = "Lista inválida.";
    return [];
  }
  const items: unknown[] = [];
  for (const rawItem of parsed) {
    if (typeof rawItem !== "object" || rawItem === null) continue;
    const source = rawItem as Record<string, unknown>;
    const item: Record<string, unknown> = {};
    let hasContent = false;
    let problem: string | null = null;
    for (const spec of field.items) {
      const value = source[spec.key];
      if (spec.type === "image") {
        const id = typeof value === "number" ? readId(String(value)) : typeof value === "string" ? readId(value) : null;
        if (id === undefined) problem ??= "imagem inválida.";
        item[spec.key] = id ?? null;
        if (id) mediaIds.push(id);
        continue;
      }
      const textValue = typeof value === "string" ? value.trim() : "";
      if (textValue) hasContent = true;
      if (spec.type === "href") {
        const href = normalizeHref(textValue);
        if (href === null) problem ??= `${spec.label}: ${HREF_ERROR}`;
        item[spec.key] = href ?? textValue;
      } else {
        item[spec.key] = textValue;
      }
    }
    // itens totalmente em branco (o "Adicionar" clicado sem preencher) são descartados
    if (!hasContent) continue;
    if (problem) errors[field.path] ??= `${capitalize(field.itemName)} ${items.length + 1}: ${problem}`;
    items.push(item);
  }
  return items;
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// ----------------------------------------------------------- mensagens zod
type Issue = { code: string; path: PropertyKey[]; maximum?: number | bigint; origin?: string; message: string };

function issueMessage(issue: Issue): string {
  if (issue.code === "too_big") {
    if (issue.origin === "array") return `Máximo de ${issue.maximum} itens.`;
    return `Máximo de ${issue.maximum} caracteres.`;
  }
  if (issue.code === "too_small") return REQUIRED;
  return "Valor inválido. Confira este campo.";
}

/** Erros do zod → `{ caminho: mensagem }`; erros dentro de itens de lista sobem para o campo da lista. */
function zodErrors(issues: readonly Issue[], section: SectionConfig): Record<string, string> {
  const listPaths = section.groups.flatMap((g) => g.fields).filter((f) => f.type === "list").map((f) => f.path);
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    let key = issue.path.join(".");
    let message = issueMessage(issue);
    const list = listPaths.find((p) => key.startsWith(`${p}.`));
    if (list) {
      const index = Number(key.slice(list.length + 1).split(".")[0]);
      const spec = section.groups.flatMap((g) => g.fields).find((f) => f.path === list);
      const name = spec?.type === "list" ? capitalize(spec.itemName) : "Item";
      message = `${name} ${Number.isInteger(index) ? index + 1 : ""}: ${message}`.replace("  ", " ");
      key = list;
    }
    errors[key] ??= message;
  }
  return errors;
}

// ---------------------------------------------------------------- principal
export function parseSectionForm(key: SiteContentKey, formData: FormData): ParsedSection {
  const section = SITE_SECTIONS[key];
  const read = (name: string): string => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const values: Record<string, string> = {};
  for (const [name, value] of formData.entries()) if (typeof value === "string" && !name.startsWith("$ACTION")) values[name] = value;

  const errors: Record<string, string> = {};
  const mediaIds: number[] = [];
  const data: Record<string, unknown> = {};

  const fail = (path: string, message: string) => {
    errors[path] ??= message;
  };

  for (const group of section.groups) {
    for (const field of group.fields) {
      switch (field.type) {
        case "text":
        case "textarea":
        case "markdown": {
          const value = read(field.path).trim();
          if (field.required && !value) fail(field.path, REQUIRED);
          setPath(data, field.path, value);
          break;
        }
        case "email": {
          const value = read(field.path).trim().toLowerCase();
          if (value && !EMAIL_RE.test(value)) fail(field.path, "E-mail inválido. Exemplo: contato@nosstudio.com.br");
          setPath(data, field.path, value);
          break;
        }
        case "phone": {
          const value = read(field.path).trim();
          if (value && !isValidPhone(value)) fail(field.path, "Informe o número com DDD. Exemplo: (11) 91234-5678");
          setPath(data, field.path, value);
          break;
        }
        case "instagram": {
          const raw = read(field.path);
          const value = normalizeInstagram(raw);
          if (value === null) fail(field.path, "Use só o nome do perfil, como @nosstudio.cria");
          setPath(data, field.path, value ?? raw.trim());
          break;
        }
        case "switch":
          setPath(data, field.path, ["on", "true", "1"].includes(read(field.path)));
          break;
        case "link": {
          const label = read(`${field.path}.label`).trim();
          const raw = read(`${field.path}.href`);
          const href = normalizeHref(raw);
          if (href === null) fail(`${field.path}.href`, HREF_ERROR);
          if (href && !label) fail(`${field.path}.label`, "Escreva o texto do botão ou apague o link.");
          setPath(data, field.path, { label, href: href ?? raw.trim() });
          break;
        }
        case "image": {
          const id = readId(read(field.path));
          if (id === undefined) fail(field.path, "Imagem inválida. Envie o arquivo de novo.");
          if (id) mediaIds.push(id);
          setPath(data, field.path, id ?? null);
          break;
        }
        case "list":
          setPath(data, field.path, buildList(field, read(field.path), errors, mediaIds));
          break;
        case "seoPage": {
          const title = read(`${field.path}.title`).trim();
          if (field.required && !title) fail(`${field.path}.title`, REQUIRED);
          setPath(data, field.path, { title, description: read(`${field.path}.description`).trim() });
          break;
        }
      }
    }
  }

  const result = siteContentSchemas[key].safeParse(data);
  if (!result.success) {
    for (const [path, message] of Object.entries(zodErrors(result.error.issues as Issue[], section))) errors[path] ??= message;
  }
  if (Object.keys(errors).length > 0 || !result.success) return { ok: false, errors, values };
  return { ok: true, data: result.data as Record<string, unknown>, mediaIds };
}
