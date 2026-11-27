import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { canReadRestrictedMedia } from "@/server/access/media";
import { parseRange } from "@/server/media/range";
import { isValidStorageKey, mainKeyOf, storage } from "@/server/media/storage";
import { getBannerMediaIds, getPublishedMediaIds } from "@/server/site/queries";

const notFound = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Entrega dos uploads.
 * - Só serve chaves registradas na tabela `media` (principal ou versão redimensionada) — nada de arquivo solto.
 * - Públicos (imagens e vídeos curtos de banner): entregues a qualquer visitante ENQUANTO algum conteúdo
 *   publicado do site os usa (banner ligado e ainda dentro do período conta como publicado). Imagem de
 *   conteúdo despublicado/em rascunho (ou upload ainda não salvo) só aparece para quem está logado — assim,
 *   despublicar um depoimento ou projeto tira a foto do ar de verdade, mesmo para quem guardou o link.
 *   Cache de 1 dia (não "immutable"): navegadores e CDNs voltam a perguntar, e uma imagem retirada some.
 * - Privados: exigem sessão DO PAINEL com permissão no módulo que usa o arquivo (comprovante → financeiro,
 *   contrato → contratos, material da marca → marca; regras em src/server/access/media.ts). Freelancer e cliente
 *   nunca recebem nada por aqui. Sem sessão ou sem permissão a resposta é 404 (não revela que o arquivo existe).
 * - Trechos (`Range: bytes=…`): respondidos com 206 — o Safari só toca vídeo assim. As regras de acesso acima
 *   valem igual para um trecho; `If-Range` com outra versão do arquivo devolve o arquivo inteiro.
 * - Sempre: `nosniff`; a CSP restritiva de /media/** é definida em next.config.ts (nenhum arquivo enviado
 *   executa como página).
 */
export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  const key = (await context.params).key.join("/");
  if (!isValidStorageKey(key)) return notFound();

  const [row] = await db.select().from(media).where(eq(media.storageKey, mainKeyOf(key)));
  if (!row) return notFound();
  const isVariant = key !== row.storageKey;
  if (isVariant && !(Array.isArray(row.variants) && row.variants.some((variant) => variant.key === key))) return notFound();

  const isPrivate = row.visibility === "private";
  // "restrito" = só com sessão do painel e permissão: arquivos privados e imagens públicas fora de conteúdo publicado
  const restricted = isPrivate || !((await getPublishedMediaIds()).includes(row.id) || (await getBannerMediaIds()).includes(row.id));
  if (restricted) {
    const user = await getSessionUser();
    if (!user || user.mustChangePassword || !(await canReadRestrictedMedia(user, row))) return notFound();
  }

  const info = await storage.stat(key);
  if (!info) return notFound();

  const etag = `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": row.mime,
    "Content-Length": String(info.size),
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Cache-Control": restricted ? "private, no-store" : "public, max-age=86400",
  });

  const inlineable = row.mime === "application/pdf" || row.mime.startsWith("image/");
  const wantsInline = new URL(request.url).searchParams.get("inline") === "1";
  if (isPrivate) {
    const fallback = row.originalName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    const disposition = inlineable && wantsInline ? "inline" : "attachment";
    headers.set("Content-Disposition", `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(row.originalName)}`);
  }
  if (!restricted && request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  // Pedido de trecho. `If-Range`: só vale se o cliente tem ESTA versão do arquivo; senão, vai o arquivo inteiro.
  const ifRange = request.headers.get("if-range");
  const wanted = ifRange && ifRange !== etag ? ({ kind: "full" } as const) : parseRange(request.headers.get("range"), info.size);
  if (wanted.kind === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${info.size}`);
    headers.delete("Content-Length");
    return new Response(null, { status: 416, headers });
  }
  if (wanted.kind === "partial") {
    const { start, end } = wanted.range;
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(storage.stream(key, wanted.range), { status: 206, headers });
  }
  return new Response(storage.stream(key), { headers });
}
