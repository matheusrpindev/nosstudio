/**
 * Quebra do título de um banner em até duas linhas e as métricas para o corpo caber na coluna. Arquivo puro.
 * - Com vírgula ou fim de frase no meio, quebra ali ("Não apenas vídeos." / "Histórias.") — regra de `splitTitle`.
 * - Frase única e longa ("O comum não é nosso estilo."): quebra entre palavras, no ponto que deixa as duas linhas
 *   mais parecidas em largura.
 * A segunda linha recebe a cor de destaque.
 */
import { splitTitle, titleMetrics } from "./text";

/** Abaixo disto (em "letras médias", ver `titleMetrics`) uma frase única fica numa linha só. */
const SINGLE_LINE_MAX = 13;

const width = (text: string) => titleMetrics([text]).line;

export function bannerTitleLines(title: string): [string, string | null] {
  const [first, second] = splitTitle(title);
  if (second) return [first, second];
  const words = first.split(/\s+/).filter(Boolean);
  if (words.length < 3 || width(first) <= SINGLE_LINE_MAX) return [first, null];
  let best: [string, string] | null = null;
  let bestGap = Infinity;
  for (let cut = 1; cut < words.length; cut++) {
    const a = words.slice(0, cut).join(" ");
    const b = words.slice(cut).join(" ");
    // prefere a primeira linha mais longa: a de baixo é a de destaque e fica melhor curta ("nosso estilo.")
    const gap = Math.abs(width(a) - width(b)) + (width(b) > width(a) ? 2 : 0);
    if (gap < bestGap) {
      bestGap = gap;
      best = [a, b];
    }
  }
  return best ?? [first, null];
}

/** Métricas das linhas (maior palavra e maior linha) para as variáveis CSS `--b-word` / `--b-line`. */
export function bannerTitleMetrics(lines: readonly (string | null)[]): { word: number; line: number } {
  return titleMetrics([...lines]);
}
