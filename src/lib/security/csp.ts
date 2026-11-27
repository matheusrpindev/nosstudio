/**
 * Content-Security-Policy do site e dos ambientes privados — fonte única, usada por `next.config.ts` (site
 * público) e por `src/proxy.ts` (painel, telas de acesso, Área da Equipe e Área do Cliente). Arquivo puro.
 *
 * Por que duas políticas (guia do Next: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 *
 * - PRIVADA (com nonce): painel, /login, /recuperar-senha, /redefinir-senha, /convite, /conta, /equipe, /cliente.
 *   Essas telas são renderizadas a cada requisição (dependem da sessão), então o proxy gera um nonce novo por
 *   requisição, o Next o aplica sozinho aos scripts dele e a política aceita SÓ scripts com o nonce
 *   (`'strict-dynamic'` libera o que eles carregam). Um script injetado (XSS) não roda.
 * - PÚBLICA (sem nonce): o site é ESTÁTICO por desenho (gerado no build, servido do cache). Nonce exige
 *   renderização a cada requisição — o site perderia o cache e ficaria mais lento. Hash também não serve: o Next
 *   embute no HTML scripts inline com os dados da página (diferentes em cada página e a cada publicação), e
 *   qualquer hash na política faz o navegador ignorar `'unsafe-inline'`. Fica `'self' 'unsafe-inline'` para
 *   scripts — sem `'unsafe-eval'` em produção, sem nenhum domínio de terceiros, sem atributos de evento
 *   (`script-src-attr 'none'`), sem plugins, sem `<base>` e sem envio de formulário para fora. A defesa contra
 *   injeção no site público continua sendo não renderizar HTML vindo do banco (regra do CLAUDE.md).
 *
 * Estilos: `'unsafe-inline'` nas duas. O Next, o Radix e o próprio código usam `style="…"` (posição de popover,
 * proporção de imagem, variáveis CSS) e o Radix injeta `<style>` em tempo de execução sem nonce; estilo inline não
 * executa código, e bloquear quebraria a interface.
 */

export type CspOptions = {
  /** Desenvolvimento: o React usa `eval` para reconstruir pilhas de erro (só em dev). */
  dev: boolean;
};

/** Vídeos de portfólio, serviços e depoimentos: só os players oficiais (YouTube no modo sem cookies e Vimeo). */
const VIDEO_FRAMES = ["https://www.youtube-nocookie.com", "https://player.vimeo.com"];

function serialize(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

/**
 * Diretivas comuns às duas políticas. `script-src` vem logo depois de `default-src` (posto por quem chama) e ANTES
 * de `script-src-attr`: o Next acha o nonce na PRIMEIRA diretiva que começa com "script-src".
 */
function base(scriptSrc: string[]): Record<string, string[]> {
  return {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "script-src-attr": ["'none'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'"],
    // o beacon de visitas (/api/visita) e as Server Actions são do próprio site
    "connect-src": ["'self'"],
    "manifest-src": ["'self'"],
    "frame-src": ["'self'", ...VIDEO_FRAMES],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
  };
}

/** Política do site público (estático): sem nonce. Uploads vêm de /media (mesma origem). */
export function publicCsp({ dev }: CspOptions): string {
  return serialize({
    ...base(["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]),
    "img-src": ["'self'", "data:"],
    "media-src": ["'self'"],
  });
}

/**
 * Política dos ambientes privados (renderização por requisição): só roda script com o `nonce` desta resposta.
 * `blob:` em imagem/mídia: prévias locais de arquivos no painel.
 */
export function privateCsp(nonce: string, { dev }: CspOptions): string {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nonce)) throw new Error("nonce inválido");
  return serialize({
    ...base(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])]),
    "img-src": ["'self'", "data:", "blob:"],
    "media-src": ["'self'", "blob:"],
  });
}

/** Nonce novo (128 bits, base64). Web Crypto: funciona no proxy e no Node. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Caminhos que recebem a política PRIVADA (com nonce) pelo proxy. O `next.config.ts` aplica a pública a todo o
 * resto (menos /media, que tem política própria). Mantenha em sincronia com o `matcher` de src/proxy.ts.
 */
export const PRIVATE_CSP_PATH = /^\/(?:painel|equipe|cliente|conta)(?:\/|$)|^\/(?:login|recuperar-senha|redefinir-senha|convite)\/?$/;

/**
 * `source` (sintaxe do next.config) dos caminhos que recebem a política PÚBLICA: tudo, menos /media e os caminhos
 * de `PRIVATE_CSP_PATH` (o teste csp.test.ts confere que as duas regras não se sobrepõem nem deixam buraco).
 */
export const PUBLIC_CSP_SOURCE = "/((?!media/|painel|equipe|cliente|conta/|conta$|login$|recuperar-senha$|redefinir-senha$|convite$).*)";
