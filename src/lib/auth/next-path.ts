/** Destino padrão depois do login. */
export const PANEL_HOME = "/painel";

/**
 * Só aceita caminhos internos do painel como destino pós-login (evita open redirect).
 * Caracteres de controle (CR/LF, tab…) são recusados: iriam parar no cabeçalho do redirecionamento e o login
 * terminaria em tela de erro. Arquivo puro, testado em next-path.test.ts.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length > 500) return PANEL_HOME;
  if (!(next === PANEL_HOME || next.startsWith(`${PANEL_HOME}/`) || next.startsWith(`${PANEL_HOME}?`))) return PANEL_HOME;
  if (next.includes("\\") || next.includes("://") || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(next)) return PANEL_HOME;
  try {
    // Normaliza (resolve "..", codifica acentos e espaços) e confere de novo onde o caminho vai parar.
    const url = new URL(next, "http://painel.invalid");
    if (url.origin !== "http://painel.invalid") return PANEL_HOME;
    if (url.pathname !== PANEL_HOME && !url.pathname.startsWith(`${PANEL_HOME}/`)) return PANEL_HOME;
    return url.pathname + url.search + url.hash;
  } catch {
    return PANEL_HOME;
  }
}
