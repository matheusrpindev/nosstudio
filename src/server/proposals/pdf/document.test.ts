import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toPublicProposal, type ProposalSource } from "@/lib/proposals/public";
import { renderProposalPdf } from "./render";

/** Proposta de casamento do briefing (R$ 10.900, entrada de 30%), com todos os blocos opcionais preenchidos. */
const source: ProposalSource = {
  proposal: {
    number: "2026-001",
    version: 1,
    modality: "casamento",
    title: "Cobertura de casamento",
    clientDisplayName: "Ana & Bruno",
    contactName: "Ana",
    eventDate: "2027-04-17",
    eventLocation: "Espaço Jardim — Campinas/SP",
    validUntil: "2026-12-01",
    intro:
      "Cobertura completa de fotografia e filme do casamento, do making of à festa, para registrar os momentos espontâneos e contar a história do casal com sensibilidade.",
    scheduleText: "8 horas de cobertura no dia do casamento, com 2 fotógrafos e 2 filmmakers.",
    exclusions: "- Deslocamento para fora da região\n- Taxas do local do evento",
    paymentNotes: "Pagamento por Pix ou transferência. A data fica reservada após a confirmação da entrada.",
    conditions: "Os materiais são entregues por link, em galeria digital.\n\n**Remarcações** estão sujeitas à disponibilidade de agenda.",
    discountCents: 0,
    discountLabel: "",
    discountApproved: false,
    showItemPrices: false,
    entryMode: "percentual",
    entryPercent: 30,
    entryCents: 0,
  },
  items: [
    { kind: "incluso", title: "Cobertura de casamento", description: "8 horas de cobertura", quantity: 1, unit: "", unitPriceCents: 1090000, sortOrder: 1 },
    { kind: "incluso", title: "Fotógrafos", description: "", quantity: 2, unit: "profissionais", unitPriceCents: 0, sortOrder: 2 },
    { kind: "incluso", title: "Filmmakers", description: "", quantity: 2, unit: "profissionais", unitPriceCents: 0, sortOrder: 3 },
    { kind: "incluso", title: "Making of", description: "Bastidores e preparação dos noivos", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 4 },
    { kind: "incluso", title: "Ensaio pré-wedding", description: "Incluso, sem cobrança adicional", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 5 },
    { kind: "incluso", title: "Fotografias digitais", description: "", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 6 },
    { kind: "incluso", title: "Filme de melhores momentos", description: "", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 7 },
    { kind: "incluso", title: "Teaser vertical", description: "Vídeo curto no formato das redes sociais", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 8 },
    { kind: "incluso", title: "Galeria digital", description: "Entrega das fotos por link", quantity: 1, unit: "", unitPriceCents: 0, sortOrder: 9 },
    { kind: "opcional", title: "Álbum impresso 30×30", description: "Capa em tecido, 40 páginas", quantity: 1, unit: "", unitPriceCents: 180000, sortOrder: 10 },
  ],
  payments: [
    { label: "Entrada (30%)", dueDate: null, dueLabel: "na reserva da data", amountCents: 327000, sortOrder: 1 },
    { label: "Saldo restante", dueDate: "2027-04-10", dueLabel: "", amountCents: 763000, sortOrder: 2 },
  ],
  clientName: "Ana Souza",
  ownerName: "Pedro Henrique",
  issuedOn: "2026-11-17",
  company: {
    brandName: "NÓS Studio",
    tagline: "Sua história, nosso olhar.",
    descriptor: "Marketing, comunicação e audiovisual",
    aboutText:
      "A NÓS Studio nasceu da conexão entre duas pessoas: Pedro Henrique e Laura Nepomuceno. Dois olhares e uma vontade em comum: transformar criatividade, comunicação e audiovisual em histórias bem contadas.\n\nUnimos estratégia, conteúdo e produção audiovisual para aproximar pessoas, marcas e momentos.",
    whatsapp: "11912345678",
    email: "contato@exemplo.com.br",
    instagram: "@nosstudio.cria",
    siteUrl: "https://exemplo.com.br",
  },
};

describe("PDF da proposta", () => {
  it("gera um PDF válido com a proposta de casamento de exemplo", async () => {
    const pdf = await renderProposalPdf(toPublicProposal(source));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(15_000);
    // Para inspeção visual: PDF_OUT=/caminho/arquivo.pdf npx vitest run src/server/proposals/pdf
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  }, 30_000);

  it("gera o PDF mesmo com a proposta mínima (sem textos, sem pagamentos)", async () => {
    const minimal: ProposalSource = {
      ...source,
      proposal: { ...source.proposal, intro: "", scheduleText: "", exclusions: "", paymentNotes: "", conditions: "", validUntil: null, eventDate: null, eventLocation: "", contactName: "" },
      items: source.items.slice(0, 1),
      payments: [],
      company: { ...source.company, aboutText: "", whatsapp: "", email: "", siteUrl: "" },
    };
    const pdf = await renderProposalPdf(toPublicProposal(minimal));
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 30_000);
});
