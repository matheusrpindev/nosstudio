import { revalidateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import { deleteMedia, findMediaUsage, getMediaById, toMediaValue, updateMediaAlt } from "@/server/media";
import { SITE_TAG } from "@/server/site/cache";
import { authorize, json } from "../guard";

type Context = { params: Promise<{ id: string }> };

async function parseId(context: Context): Promise<number | null> {
  const id = Number((await context.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Atualiza o texto alternativo. JSON: { alt }. */
export async function PATCH(request: Request, context: Context) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  const id = await parseId(context);
  if (!id) return json({ error: "Arquivo não encontrado." }, 404);

  let alt: unknown;
  try {
    alt = (await request.json())?.alt;
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  if (typeof alt !== "string") return json({ error: "Informe o texto alternativo." }, 400);

  const row = await updateMediaAlt(id, alt);
  if (!row) return json({ error: "Arquivo não encontrado." }, 404);
  // O texto alternativo aparece no site: renova o cache público na hora.
  if (row.visibility === "public") revalidateTag(SITE_TAG, { expire: 0 });
  return json({ media: toMediaValue(row) });
}

/** Apaga o arquivo, desde que não esteja em uso. */
export async function DELETE(request: Request, context: Context) {
  const user = await authorize(request, "excluir");
  if (user instanceof Response) return user;
  const id = await parseId(context);
  const row = id ? await getMediaById(id) : null;
  if (!id || !row) return json({ error: "Arquivo não encontrado." }, 404);

  const usage = await findMediaUsage(id);
  if (usage.length > 0) {
    return json({ error: `Este arquivo está em uso em: ${usage.slice(0, 3).join(", ")}. Remova-o de lá antes de apagar.` }, 409);
  }
  await deleteMedia(id);
  await logAudit({ user, action: "delete", entity: "media", entityId: id, summary: `Apagou um arquivo ${row.visibility === "public" ? "público (imagem)" : "privado"}` });
  return new Response(null, { status: 204 });
}
