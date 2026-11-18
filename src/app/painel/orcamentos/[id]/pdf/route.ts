import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { proposalFileName } from "@/lib/proposals/public";
import { renderProposalPdf } from "@/server/proposals/pdf/render";
import { loadPublicProposal } from "@/server/proposals/source";

/**
 * PDF da proposta. A pré-visualização do painel (iframe) e o download usam esta mesma rota — o arquivo é
 * idêntico nos dois casos. `?baixar=1` força o download. Só usuários logados.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Não autorizado", { status: 401 });

  const id = Number((await context.params).id);
  const proposal = Number.isInteger(id) && id > 0 ? await loadPublicProposal(id) : null;
  if (!proposal) return new Response("Proposta não encontrada", { status: 404 });

  const pdf = await renderProposalPdf(proposal);
  const download = new URL(request.url).searchParams.get("baixar") === "1";
  const fileName = proposalFileName(proposal);
  if (download) {
    await logAudit({ user, action: "pdf", entity: "proposal", entityId: id, summary: `Baixou o PDF da proposta ${proposal.number}` });
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
