/**
 * Carrega uma proposta do banco e monta a visão pública usada pelo PDF.
 * (O editor de orçamentos do painel tem suas próprias consultas; aqui só o caminho banco → PDF.)
 */
import "server-only";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, proposalItems, proposalPayments, proposals, users } from "@/db/schema";
import { toISODate, todayISO } from "@/lib/dates";
import { env } from "@/lib/env";
import { toPublicProposal, type PublicProposal } from "@/lib/proposals/public";
import { getSetting } from "@/server/settings";
import { getSiteContentForEdit } from "@/server/site/content";

/** Visão pública de uma proposta (ou `null` se não existir). Nunca inclui custos ou notas internas. */
export async function loadPublicProposal(id: number): Promise<PublicProposal | null> {
  const [row] = await db
    .select({ proposal: proposals, clientName: clients.name, ownerName: users.name })
    .from(proposals)
    .leftJoin(clients, eq(clients.id, proposals.clientId))
    .leftJoin(users, eq(users.id, proposals.ownerId))
    .where(eq(proposals.id, id));
  if (!row) return null;

  const [items, payments, settings, general] = await Promise.all([
    db.select().from(proposalItems).where(eq(proposalItems.proposalId, id)).orderBy(asc(proposalItems.sortOrder), asc(proposalItems.id)),
    db
      .select()
      .from(proposalPayments)
      .where(eq(proposalPayments.proposalId, id))
      .orderBy(asc(proposalPayments.sortOrder), asc(proposalPayments.id)),
    getSetting("proposal"),
    getSiteContentForEdit("general"),
  ]);

  return toPublicProposal({
    proposal: row.proposal,
    items,
    payments,
    clientName: row.clientName ?? "",
    ownerName: row.ownerName ?? "",
    // emissão = data do envio; enquanto é rascunho, a data de hoje
    issuedOn: row.proposal.sentAt ? toISODate(row.proposal.sentAt) : todayISO(),
    company: {
      brandName: general.brandName,
      tagline: general.tagline,
      descriptor: general.descriptor,
      aboutText: settings.aboutText,
      whatsapp: general.whatsapp,
      email: general.email,
      instagram: general.instagram,
      siteUrl: env.siteUrl.includes("localhost") ? "" : env.siteUrl,
    },
  });
}

/** Próximo número de proposta do ano: `2026-001`, `2026-002`… (modelos não entram na contagem). */
export async function nextProposalNumber(year = todayISO().slice(0, 4)): Promise<string> {
  const [row] = await db
    .select({ last: sql<string | null>`max(${proposals.number})` })
    .from(proposals)
    .where(and(eq(proposals.isTemplate, false), like(proposals.number, `${year}-%`)));
  const last = row?.last ? Number(row.last.split("-")[1]) : 0;
  return `${year}-${String((Number.isFinite(last) ? last : 0) + 1).padStart(3, "0")}`;
}
