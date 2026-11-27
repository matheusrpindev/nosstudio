import { logAudit } from "@/lib/audit";
import { createMedia, MediaError, toMediaValue } from "@/server/media";
import { FILE_MAX_BYTES, VIDEO_MAX_BYTES } from "@/server/media/process";
import { authorize, json } from "./guard";

/**
 * Upload de arquivo pelo painel. multipart/form-data: file, visibility ("public" | "private"), alt e, opcional,
 * kind ("video" = vídeo curto público do site, MP4/WebM até 30 MB; sem isto, arquivo público é sempre imagem).
 */
export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  // Recusa cedo pelo cabeçalho; o tamanho real é conferido de novo depois de ler o arquivo.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > Math.max(FILE_MAX_BYTES, VIDEO_MAX_BYTES) + 1024 * 1024) return json({ error: "Arquivo grande demais (máximo de 30 MB)." }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Não foi possível ler o envio. Tente de novo." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Selecione um arquivo para enviar." }, 400);
  const visibility = form.get("visibility") === "private" ? "private" : "public";
  const kind = visibility === "public" && form.get("kind") === "video" ? "video" : "image";
  if (kind === "video" ? file.size > VIDEO_MAX_BYTES : file.size > FILE_MAX_BYTES) {
    return json({ error: kind === "video" ? "Vídeo grande demais (máximo de 30 MB)." : "Arquivo grande demais (máximo de 25 MB)." }, 413);
  }
  const alt = typeof form.get("alt") === "string" ? (form.get("alt") as string) : "";

  try {
    const row = await createMedia({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      visibility,
      kind,
      alt,
      userId: user.id,
    });
    await logAudit({ user, action: "upload", entity: "media", entityId: row.id, summary: `Enviou um arquivo ${row.visibility === "public" ? (kind === "video" ? "público (vídeo)" : "público (imagem)") : "privado"}` });
    return json({ media: toMediaValue(row) }, 201);
  } catch (error) {
    if (error instanceof MediaError) return json({ error: error.message }, error.status);
    console.error("[media] falha no upload", error);
    return json({ error: "Não foi possível salvar o arquivo. Tente de novo." }, 500);
  }
}
