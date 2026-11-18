import { describe, expect, it } from "vitest";
import { dropBlankRows, draftNumbers, proposalDraftSchema, stepOfField, type ProposalDraft } from "./draft";

const base: ProposalDraft = {
  templateName: "",
  modality: "casamento",
  clientId: 1,
  clientDisplayName: "Ana & Bruno",
  contactName: "",
  ownerId: null,
  title: "Cobertura de casamento",
  eventDate: "",
  eventLocation: "",
  validUntil: null,
  intro: "",
  scheduleText: "",
  exclusions: "",
  paymentNotes: "",
  conditions: "",
  items: [
    { kind: "incluso", title: "Cobertura", description: "", quantity: 1, unit: "", unitPriceCents: 1_090_000 },
    { kind: "incluso", title: "Fotógrafos", description: "", quantity: 2, unit: "profissionais", unitPriceCents: 0 },
    { kind: "opcional", title: "Álbum", description: "", quantity: 1, unit: "", unitPriceCents: 150_000 },
  ],
  discountCents: 0,
  discountLabel: "",
  discountApproved: false,
  showItemPrices: false,
  entryMode: "percentual",
  entryPercent: 30,
  entryCents: 0,
  payments: [],
  costs: [{ category: "equipe", description: "Freelancers", amountCents: 300_000 }],
  overheadCents: 100_000,
  taxPercent: 6,
  targetMarginPercent: 40,
  internalNotes: "",
};

describe("draftNumbers", () => {
  it("calcula total, sinal e saldo do casamento de referência", () => {
    const { client } = draftNumbers(base);
    expect(client.totalCents).toBe(1_090_000);
    expect(client.entryCents).toBe(327_000);
    expect(client.balanceCents).toBe(763_000);
    expect(client.optionalsTotalCents).toBe(150_000);
  });

  it("desconto não aprovado fica fora do total e aparece como pendente", () => {
    const numbers = draftNumbers({ ...base, discountCents: 90_000 });
    expect(numbers.client.totalCents).toBe(1_090_000);
    expect(numbers.pendingDiscountCents).toBe(90_000);
    expect(draftNumbers({ ...base, discountCents: 90_000, discountApproved: true }).client.totalCents).toBe(1_000_000);
  });

  it("indica a diferença entre parcelas e total", () => {
    const payments = [{ label: "Entrada", dueDate: null, dueLabel: "", amountCents: 300_000 }];
    expect(draftNumbers({ ...base, payments }).paymentsDifferenceCents).toBe(-790_000);
  });

  it("calcula margem líquida e sinaliza abaixo da meta", () => {
    const { internal } = draftNumbers(base);
    expect(internal.directCostCents).toBe(300_000);
    expect(internal.taxCents).toBe(65_400);
    expect(internal.totalCostCents).toBe(465_400);
    expect(internal.profitCents).toBe(624_600);
    expect(internal.netMarginPercent).toBe(57.3);
    expect(internal.belowTarget).toBe(false);
    expect(draftNumbers({ ...base, targetMarginPercent: 70 }).internal.belowTarget).toBe(true);
  });
});

describe("dropBlankRows", () => {
  it("descarta linhas totalmente em branco e mantém as com algum conteúdo", () => {
    const draft = dropBlankRows({
      ...base,
      items: [...base.items, { kind: "incluso", title: "", description: "", quantity: 1, unit: "", unitPriceCents: 0 }],
      costs: [...base.costs, { category: "outros", description: "", amountCents: 0 }],
      payments: [
        { label: "", dueDate: null, dueLabel: "", amountCents: 0 },
        { label: "", dueDate: null, dueLabel: "", amountCents: 500 },
      ],
    });
    expect(draft.items).toHaveLength(3);
    expect(draft.costs).toHaveLength(1);
    expect(draft.payments).toHaveLength(1);
  });
});

describe("proposalDraftSchema", () => {
  it("aceita o rascunho de referência e normaliza datas vazias para null", () => {
    const parsed = proposalDraftSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.eventDate).toBeNull();
  });

  it("recusa item sem título, percentual acima de 100 e valor negativo", () => {
    expect(proposalDraftSchema.safeParse({ ...base, items: [{ ...base.items[0], title: "" }] }).success).toBe(false);
    expect(proposalDraftSchema.safeParse({ ...base, taxPercent: 101 }).success).toBe(false);
    expect(proposalDraftSchema.safeParse({ ...base, overheadCents: -1 }).success).toBe(false);
  });

  it("descarta o texto de vencimento quando há data", () => {
    const parsed = proposalDraftSchema.parse({ ...base, payments: [{ label: "Entrada", dueDate: "2026-12-01", dueLabel: "texto", amountCents: 1 }] });
    expect(parsed.payments[0].dueLabel).toBe("");
  });
});

describe("stepOfField", () => {
  it("leva cada campo para a etapa certa", () => {
    expect(stepOfField("items.2.title")).toBe("escopo");
    expect(stepOfField("costs.0.amountCents")).toBe("interno");
    expect(stepOfField("payments")).toBe("preco");
    expect(stepOfField("conditions")).toBe("textos");
    expect(stepOfField("title")).toBe("dados");
  });
});
