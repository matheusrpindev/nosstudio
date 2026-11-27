/**
 * Cabeçalho `Range` da entrega de arquivos (/media). Arquivo puro.
 * O Safari (e o iOS inteiro) só toca um <video> se o servidor responder a pedidos de trecho com 206.
 */
export type ByteRange = { start: number; end: number };

export type RangeResult =
  /** Sem `Range`, ou um `Range` que este servidor não atende (outra unidade, vários trechos, sintaxe inválida): manda o arquivo inteiro (200). */
  | { kind: "full" }
  /** Um trecho válido (206). `end` é inclusivo. */
  | { kind: "partial"; range: ByteRange }
  /** O trecho pedido começa depois do fim do arquivo (416). */
  | { kind: "unsatisfiable" };

/**
 * Interpreta `Range: bytes=…` para um arquivo de `size` bytes. Só UM trecho é atendido — `bytes=0-99`,
 * `bytes=100-` (do 100 ao fim) ou `bytes=-500` (os últimos 500); a RFC 9110 permite ignorar o resto.
 */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return { kind: "full" };
  const match = /^bytes=(\d{0,15})-(\d{0,15})$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return { kind: "full" };
  if (size <= 0) return { kind: "unsatisfiable" };

  if (match[1] === "") {
    // sufixo: os últimos N bytes
    const suffix = Number(match[2]);
    if (suffix === 0) return { kind: "unsatisfiable" };
    return { kind: "partial", range: { start: Math.max(0, size - suffix), end: size - 1 } };
  }
  const start = Number(match[1]);
  const end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size) return { kind: "unsatisfiable" };
  if (end < start) return { kind: "full" }; // "bytes=5-2" é inválido: ignora o cabeçalho
  return { kind: "partial", range: { start, end } };
}
