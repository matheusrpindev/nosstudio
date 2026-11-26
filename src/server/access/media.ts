/**
 * Quem pode abrir um arquivo RESTRITO de /media (privado, ou imagem pública fora de conteúdo publicado).
 * O arquivo herda a permissão do módulo que o usa: comprovante → financeiro; contrato assinado → contratos;
 * material da marca → marca; imagem do site → site. Arquivo ainda sem dono (upload recém-feito, antes de salvar
 * o formulário): só quem enviou, ou quem tem "ver" em Arquivos no módulo inteiro.
 *
 * Perfis que não entram no painel (freelancer, cliente) nunca passam aqui: a entrega de arquivos a eles terá
 * liberação explícita (central de arquivos / galerias), não esta rota.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brandAssets, contracts, financeEntries, type Media } from "@/db/schema";
import { canEverywhere, hasEnvironment, type Module, type PermissionSubject } from "@/lib/permissions";

type MediaUser = PermissionSubject & { id: number };

/** Módulos internos do painel que usam este arquivo (contrato assinado, comprovante, material da marca). */
async function ownerModules(mediaId: number): Promise<Module[]> {
  const [contractRows, financeRows, brandRows] = await Promise.all([
    db.select({ id: contracts.id }).from(contracts).where(eq(contracts.fileMediaId, mediaId)).limit(1),
    db.select({ id: financeEntries.id }).from(financeEntries).where(eq(financeEntries.receiptMediaId, mediaId)).limit(1),
    db.select({ id: brandAssets.id }).from(brandAssets).where(eq(brandAssets.mediaId, mediaId)).limit(1),
  ]);
  const modules: Module[] = [];
  if (contractRows.length) modules.push("contratos");
  if (financeRows.length) modules.push("financeiro");
  if (brandRows.length) modules.push("marca");
  return modules;
}

export async function canReadRestrictedMedia(user: MediaUser | null, row: Pick<Media, "id" | "visibility" | "uploadedBy">): Promise<boolean> {
  if (!user || !hasEnvironment(user.role, "painel")) return false;
  if (row.uploadedBy === user.id) return true;
  const modules = await ownerModules(row.id);
  if (row.visibility !== "private") {
    // imagem pública fora do ar (rascunho, despublicada): quem cuida do site, ou quem vê o módulo que a usa
    return canEverywhere(user, "site", "ver") || modules.some((mod) => canEverywhere(user, mod, "ver"));
  }
  if (modules.length === 0) return canEverywhere(user, "arquivos", "ver");
  // abrir o arquivo é baixar o documento: exige "baixar" em algum módulo que o usa
  return modules.some((mod) => canEverywhere(user, mod, "baixar"));
}
