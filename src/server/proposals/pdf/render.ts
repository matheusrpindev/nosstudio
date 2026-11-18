import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import type { PublicProposal } from "@/lib/proposals/public";
import { ProposalDocument } from "./document";

/** Gera o PDF da proposta a partir da visão pública. */
export function renderProposalPdf(proposal: PublicProposal): Promise<Buffer> {
  return renderToBuffer(createElement(ProposalDocument, { proposal }) as Parameters<typeof renderToBuffer>[0]);
}
