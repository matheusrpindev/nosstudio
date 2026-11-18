import "server-only";
import { db } from "@/db";
import { leads, type Lead, type LeadDetails } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { SERVICE_INTEREST_LABELS } from "@/lib/domain";
import { onlyDigits, whatsAppLink } from "@/lib/format";
import type { LeadFormData } from "@/lib/site/lead-form";

/** Grava um lead vindo do site (dados já validados por `leadFormSchema`). */
export async function createLead(data: LeadFormData, consentVersion: string): Promise<Lead> {
  const details: LeadDetails = {};
  for (const key of ["eventType", "eventLocation", "guests", "startTime", "endTime", "coverage", "storymaker", "packageName"] as const) {
    if (data[key]) details[key] = data[key];
  }
  const [lead] = await db
    .insert(leads)
    .values({
      name: data.name,
      whatsapp: onlyDigits(data.whatsapp),
      email: data.email || null,
      serviceInterest: data.serviceInterest,
      eventDate: data.eventDate,
      city: data.city || null,
      message: data.message,
      details,
      source: "site",
      originPath: data.originPath || null,
      consentAt: new Date(),
      consentVersion,
      status: "novo",
    })
    .returning();
  return lead;
}

type LeadSummary = Pick<LeadFormData, "name" | "serviceInterest" | "eventDate" | "city">;

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
    details.packageName ? `Pacote/serviço: ${oneLine(details.packageName)}` : "",
    details.eventType ? `Tipo de evento: ${oneLine(details.eventType)}` : "",
    details.eventLocation ? `Local: ${oneLine(details.eventLocation)}` : "",
    details.guests ? `Convidados: ${oneLine(details.guests)}` : "",
    details.startTime || details.endTime ? `Horário: ${oneLine(details.startTime)}–${oneLine(details.endTime)}` : "",
    details.coverage ? `Cobertura: ${oneLine(details.coverage)}` : "",
    details.storymaker ? `Storymaker: ${oneLine(details.storymaker)}` : "",
    lead.originPath ? `Página de origem: ${oneLine(lead.originPath)}` : "",
    "",
    lead.message ? `Mensagem:\n${lead.message}` : "(sem mensagem)",
    "",
    `Abrir no painel: ${panelUrl}`,
  ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""));
  return { subject: `Novo contato pelo site: ${oneLine(lead.name).slice(0, 80)}`, text: lines.join("\n") };
}
