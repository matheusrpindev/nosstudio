import "server-only";
import { db } from "@/db";
import { leads, type Lead } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { SERVICE_INTEREST_LABELS } from "@/lib/domain";
import { onlyDigits, whatsAppLink } from "@/lib/format";
import { buildLeadRecord, type LeadFormData } from "@/lib/site/lead-form";
import { recordFormSubmission } from "@/server/metrics/collect";

/** Observação gravada no lead quando o formulário foi enviado rápido demais (aparece na ficha, em "Pedido"). */
export const FAST_SUBMIT_NOTE = { label: "Atenção", value: "Enviado poucos segundos depois de abrir o formulário — pode ser automático. Confira antes de responder." } as const;

/**
 * Grava um lead vindo do site (dados já validados por `leadFormSchema`).
 * `signals.tooFast`: o envio foi rápido demais para uma pessoa — o lead é gravado do mesmo jeito (nunca se perde
 * um pedido de verdade), só leva uma observação para os sócios conferirem.
 */
export async function createLead(data: LeadFormData, consentVersion: string, signals: { tooFast?: boolean } = {}): Promise<Lead> {
  // só os campos do tipo do pedido entram (ver `buildLeadRecord`)
  const { serviceInterest, eventDate, city, details } = buildLeadRecord(data);
  if (signals.tooFast) details.extras = { [FAST_SUBMIT_NOTE.label]: FAST_SUBMIT_NOTE.value };
  const [lead] = await db
    .insert(leads)
    .values({
      name: data.name,
      whatsapp: onlyDigits(data.whatsapp),
      email: data.email || null,
      serviceInterest,
      eventDate,
      city,
      message: data.message,
      details,
      source: "site",
      originPath: data.originPath || null,
      consentAt: new Date(),
      consentVersion,
      status: "novo",
    })
    .returning();
  // métricas do site: conta o envio (só o total do dia e a página do formulário — nenhum dado do lead)
  await recordFormSubmission(lead.originPath);
  return lead;
}

type LeadSummary = Pick<LeadFormData, "name" | "serviceInterest" | "eventDate"> & { city: string | null };

/** Mensagem pronta para o visitante continuar a conversa no WhatsApp depois de enviar o formulário. */
export function leadWhatsAppMessage(lead: LeadSummary): string {
  const firstName = lead.name.trim().split(/\s+/)[0];
  const parts = [`Olá! Acabei de enviar um pedido pelo site. Sou ${firstName}`];
  if (lead.serviceInterest !== "outro") {
    parts.push(` e tenho interesse em ${SERVICE_INTEREST_LABELS[lead.serviceInterest].toLowerCase()}`);
  }
  const extras = [lead.eventDate ? `data: ${formatDate(lead.eventDate)}` : "", lead.city ? `cidade: ${lead.city}` : ""].filter(Boolean);
  return `${parts.join("")}.${extras.length ? ` (${extras.join(", ")})` : ""}`;
}

export function leadWhatsAppUrl(studioWhatsapp: string, lead: LeadSummary): string | null {
  return whatsAppLink(studioWhatsapp, leadWhatsAppMessage(lead)) || null;
}

/** Texto do e-mail de aviso aos sócios. Sem HTML; quebras de linha removidas dos campos de uma linha. */
export function leadNotificationEmail(lead: Lead, panelUrl: string): { subject: string; text: string } {
  const oneLine = (value: string | null | undefined) => (value ?? "").replace(/[\r\n]+/g, " ").trim();
  const details = lead.details ?? {};
  const lines = [
    `Nome: ${oneLine(lead.name)}`,
    `WhatsApp: ${oneLine(lead.whatsapp)}`,
    lead.email ? `E-mail: ${oneLine(lead.email)}` : "",
    `Interesse: ${SERVICE_INTEREST_LABELS[lead.serviceInterest]}`,
    lead.eventDate ? `Data: ${formatDate(lead.eventDate)}` : "",
    lead.city ? `Cidade: ${oneLine(lead.city)}` : "",
    details.company ? `Empresa: ${oneLine(details.company)}` : "",
    details.packageName ? `Plano/serviço de origem: ${oneLine(details.packageName)}` : "",
    details.objective ? `Objetivo: ${oneLine(details.objective)}` : "",
    details.segment ? `Segmento: ${oneLine(details.segment)}` : "",
    details.profile ? `Perfil: ${oneLine(details.profile)}` : "",
    details.productionType ? `Tipo de produção: ${oneLine(details.productionType)}` : "",
    details.timeframe ? `Previsão: ${oneLine(details.timeframe)}` : "",
    details.eventType ? `Tipo de evento: ${oneLine(details.eventType)}` : "",
    details.eventLocation ? `Local: ${oneLine(details.eventLocation)}` : "",
    details.guests ? `Convidados: ${oneLine(details.guests)}` : "",
    details.startTime || details.endTime ? `Horário: ${[details.startTime, details.endTime].filter(Boolean).map(oneLine).join("–")}` : "",
    details.services ? `Serviços: ${oneLine(details.services)}` : "",
    details.coverage ? `Cobertura: ${oneLine(details.coverage)}` : "",
    details.storymaker ? `Storymaker: ${oneLine(details.storymaker)}` : "",
    ...Object.entries(details.extras ?? {}).map(([label, value]) => `${oneLine(label)}: ${oneLine(value)}`),
    lead.originPath ? `Página de origem: ${oneLine(lead.originPath)}` : "",
    "",
    lead.message ? `Mensagem:\n${lead.message}` : "(sem mensagem)",
    "",
    `Abrir no painel: ${panelUrl}`,
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return { subject: `Novo contato pelo site: ${oneLine(lead.name).slice(0, 80)}`, text: lines.join("\n") };
}
