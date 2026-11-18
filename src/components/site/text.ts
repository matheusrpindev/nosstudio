/**
 * Pequenas regras tipográficas do site público. Arquivo puro (servidor e cliente).
 * A copy vem do painel, então nada aqui depende de um texto ter um tamanho exato: as funções só decidem
 * ONDE quebrar ou destacar, e sempre devolvem o texto inteiro.
 */
import type { PublicPackage } from "@/server/site/queries";

export type SiteTone = "paper" | "lavanda" | "roxo" | "grafite";

/**
 * Divide um título em duas linhas na primeira vírgula ou fim de frase ("Sua história, nosso olhar." →
 * ["Sua história,", "nosso olhar."]). Sem ponto de quebra, devolve [título, null].
 */
export function splitTitle(title: string): [string, string | null] {
  const text = title.trim();
  const match = text.match(/^(.+?[,.;:!?—–])\s+(\S.*)$/);
  return match ? [match[1], match[2]] : [text, null];
}

/** Divide uma frase de impacto em duas metades no primeiro fim de frase (". ", "! ", "? "). */
export function splitStatement(text: string): [string, string | null] {
  const clean = text.trim();
  const match = clean.match(/^(.+?[.!?…])\s+(\S.*)$/);
  return match ? [match[1], match[2]] : [clean, null];
}

export type AccentParts = { before: string; accent: string; after: string };

/**
 * Trecho em destaque (o "sinal" lima) de um título.
 * - Marcação explícita no texto: `Antes de existir a NÓS, já existia *um nós.*`
 * - `tail`: sem marcação, destaca as duas últimas palavras (regra usada nos títulos de abertura).
 * - `none`: sem marcação, não destaca nada.
 */
export function parseAccent(text: string, fallback: "tail" | "none" = "none"): AccentParts {
  const clean = text.trim();
  const marked = clean.match(/^(.*?)\*(.+?)\*(.*)$/);
  if (marked) return { before: marked[1], accent: marked[2], after: marked[3] };
  if (fallback === "tail") {
    const words = clean.split(/\s+/);
    if (words.length >= 4) {
      return { before: `${words.slice(0, -2).join(" ")} `, accent: words.slice(-2).join(" "), after: "" };
    }
  }
  return { before: clean, accent: "", after: "" };
}

/** Remove a marcação de destaque (para usar o título em `aria-label`, metadados etc.). */
export function stripAccent(text: string): string {
  return text.replace(/\*(.+?)\*/g, "$1");
}

/** Métricas para o título gigante do hero caber no grid: maior palavra e maior linha, em caracteres. */
export function titleMetrics(lines: (string | null)[]): { word: number; line: number } {
  const present = lines.filter((line): line is string => Boolean(line));
  const words = present.flatMap((line) => line.split(/\s+/));
  return {
    word: Math.max(4, ...words.map((word) => word.length)),
    line: Math.max(8, ...present.map((line) => line.length)),
  };
}

/** "Cofundador | Marketing e Audiovisual" → "Cofundador · Marketing e Audiovisual" */
export function displayRole(role: string): string {
  return role.replace(/\s*\|\s*/g, " · ");
}

/** Primeira letra de um nome (monograma dos espaços de foto vazios). */
export function monogramOf(name: string): string {
  return (name.trim().match(/\p{L}/u)?.[0] ?? "").toUpperCase();
}

/** "01", "02"… */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Numeração sequencial das seções de uma página ("01 —", "02 —"…). Como só é chamada para as seções que
 * de fato renderizam, a sequência continua certa quando alguma está oculta.
 *   const next = sectionCounter();  …  <Section number={next()} …>
 */
export function sectionCounter(start = 1): () => string {
  let current = start;
  return () => pad2(current++);
}

/** Parágrafos de um texto simples (linhas em branco separam). */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Link do botão de um pacote para o formulário de contato. O <LeadForm> lê `servico` e `pacote` da URL no
 * navegador (a página de contato continua estática).
 */
export function packageContactHref(pkg: Pick<PublicPackage, "kind" | "name">, base = "/contato"): string {
  const params = new URLSearchParams();
  if (pkg.kind === "plano") params.set("servico", "pacote_mensal");
  params.set("pacote", pkg.name);
  return `${base}?${params.toString()}#formulario`;
}

/** Link do botão de um serviço para o formulário de contato, com o interesse pré-selecionado. */
export function serviceContactHref(interest: string, base = "/contato"): string {
  return `${base}?servico=${encodeURIComponent(interest)}#formulario`;
}
