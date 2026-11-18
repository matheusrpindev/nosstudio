import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isValidStorageKey, mainKeyOf, storage } from "@/server/media/storage";
import { getPublishedMediaIds } from "@/server/site/queries";

const notFound = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Entrega dos uploads.
 * - Só serve chaves registradas na tabela `media` (principal ou versão redimensionada) — nada de arquivo solto.
 * - Públicos: entregues a qualquer visitante ENQUANTO algum conteúdo publicado do site os usa. Imagem de
 *   conteúdo despublicado/em rascunho (ou upload ainda não salvo) só aparece para quem está logado — assim,
 *   despublicar um depoimento ou projeto tira a foto do ar de verdade, mesmo para quem guardou o link.
 *   Cache de 1 dia (não "immutable"): navegadores e CDNs voltam a perguntar, e uma imagem retirada some.
 * - Privados: exigem sessão; sem sessão a resposta é 404 (não revela que o arquivo existe).
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
  // "restrito" = só com sessão do painel: arquivos privados e imagens públicas fora de conteúdo publicado
  const restricted = isPrivate || !(await getPublishedMediaIds()).includes(row.id);
  if (restricted) {
    const user = await getCurrentUser();
    if (!user || user.mustChangePassword) return notFound();
  }

  const info = await storage.stat(key);
  if (!info) return notFound();

  const etag = `"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
  const headers = new Headers({
    "Content-Type": row.mime,
    "Content-Length": String(info.size),
    "X-Content-Type-Options": "nosniff",
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
  return new Response(storage.stream(key), { headers });
}
