/**
 * Formatação e normalização (pt-BR). Arquivo puro: servidor e cliente.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos → `R$ 10.900,00` */
export function formatBRL(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100).replace(/ /g, " ");
}

/** Centavos → `10.900,00` (para preencher campos de valor). */
export function centsToInput(cents: number | null | undefined): string {
  return cents == null ? "" : decimal.format(cents / 100);
}

/**
 * Texto digitado → centavos. Aceita `10900`, `10.900`, `10.900,00`, `R$ 10.900,5`, `1500.50`.
 * Retorna `null` para vazio/inválido.
 */
export function parseBRL(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== "string") return null;
  let s = input.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const negative = s.startsWith("-");
  s = s.replace(/-/g, "");
  if (s.includes(",")) {
    // vírgula é o separador decimal; pontos são milhar
    s = s.replace(/\./g, "").replace(",", ".");
  } else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) {
    // "10.900" ou "1.234.567" → pontos de milhar
    s = s.replace(/\./g, "");
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/** `12,5%` */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: digits })}%`;
}

/** Número com separador brasileiro, sem casas desnecessárias: 1.5 → `1,5`, 2 → `2`. */
export function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Telefone brasileiro: `(11) 91234-5678` / `(11) 3456-7890`. Mantém o que não reconhecer. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value.trim();
}

/** Valida telefone brasileiro com DDD (10 ou 11 dígitos, com ou sem +55). */
export function isValidPhone(value: string): boolean {
  let digits = onlyDigits(value);
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11;
}

/** Número no formato internacional usado pelo wa.me: `5511912345678`. */
export function toWhatsAppNumber(value: string | null | undefined): string {
  if (!value) return "";
  const digits = onlyDigits(value);
  if (!digits) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

/** Link de conversa no WhatsApp (link simples — não é a API oficial). */
export function whatsAppLink(phone: string | null | undefined, message?: string): string {
  const number = toWhatsAppNumber(phone);
  if (!number) return "";
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/** `@nosstudio.cria` → `https://instagram.com/nosstudio.cria` */
export function instagramLink(handle: string | null | undefined): string {
  if (!handle) return "";
  const clean = handle.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/+$/, "");
  return clean ? `https://instagram.com/${clean}` : "";
}

/** Texto → slug de URL: `Vídeo & Produção` → `video-producao`. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Iniciais para avatares: `Pedro Henrique` → `PH`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Corta texto longo com reticências. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Só aceita URLs http(s) — use antes de renderizar links vindos de formulários. */
export function safeUrl(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Link interno (`/contato`) ou externo http(s); qualquer outra coisa vira vazio.
 * "Interno" é só `/caminho`: `//host` e `/\host` (que o navegador trata como `//host`) apontam para outro site,
 * e caracteres de controle são removidos pelo navegador antes de interpretar o endereço — tudo isso é recusado.
 */
export function safeHref(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return "";
  if (/^\/(?!\/)/.test(trimmed) || trimmed.startsWith("#")) return trimmed;
  return safeUrl(trimmed);
}

/**
 * E-mail "simples" (`nome@dominio.tld`), sem nada que mude o sentido de um link `mailto:` — `?`, `&`, `#`, `%`,
 * vírgula, ponto e vírgula, aspas ou espaços (ex.: `a@b.com?bcc=outro@x.com` abriria o programa de e-mail com
 * cópia oculta para um terceiro). Use para validar e-mails vindos de formulário.
 */
export function isValidEmail(value: string): boolean {
  return value.length <= 160 && SIMPLE_EMAIL_RE.test(value);
}
const SIMPLE_EMAIL_RE = /^[^\s@?&#%,;:<>"()[\]\\/\u0000-\u001f\u007f]+@[^\s@?&#%,;:<>"()[\]\\/\u0000-\u001f\u007f]+\.[^\s@?&#%,;:<>"()[\]\\/.\u0000-\u001f\u007f]{2,}$/;

/** Link `mailto:` só para e-mails simples (ver `isValidEmail`); qualquer outra coisa vira vazio (sem link). */
export function mailtoHref(email: string | null | undefined): string {
  const trimmed = (email ?? "").trim();
  return isValidEmail(trimmed) ? `mailto:${trimmed}` : "";
}

/** Extrai o embed de vídeos do YouTube/Vimeo a partir do link comum. Retorna `null` se não reconhecer. */
export function videoEmbedUrl(value: string | null | undefined): string | null {
  const url = safeUrl(value);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v") || u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === "vimeo.com") {
    const id = u.pathname.match(/\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}?dnt=1` : null;
  }
  if (host === "player.vimeo.com") return url;
  return null;
}
