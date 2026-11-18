import { describe, expect, it } from "vitest";
import { proposalFileName, toPublicProposal, type ProposalSource } from "./public";

// Valores-sentinela: se qualquer um aparecer na saída pública, há vazamento de informação interna.
const SECRET_NOTE = "NOTA-INTERNA-SIGILOSA";
const SECRET_OVERHEAD = 7777701;
const SECRET_TAX = 13.37;
const SECRET_MARGIN = 42.42;
const SECRET_DISCOUNT = 1234501;
const SECRET_COST = 9999901;

function source(overrides: Partial<ProposalSource["proposal"]> = {}): ProposalSource {
  return {
    proposal: {
      number: "2026-007",
      version: 2,
      modality: "casamento",
      title: "Cobertura de casamento",
      clientDisplayName: "Ana & Bruno",
      contactName: "Ana",
      eventDate: "2027-04-17",
      eventLocation: "",
      validUntil: "2026-12-01",
      intro: "Cobertura completa.",
      scheduleText: "8 horas de cobertura.",
      exclusions: "",
      paymentNotes: "",
      conditions: "",
      discountCents: SECRET_DISCOUNT,
      discountLabel: "Desconto em análise",
      discountApproved: false,
      showItemPrices: false,
      entryMode: "percentual",
      entryPercent: 30,
      entryCents: 0,
      internalNotes: SECRET_NOTE,
      overheadCents: SECRET_OVERHEAD,
      taxPercent: SECRET_TAX,
      targetMarginPercent: SECRET_MARGIN,
      ...overrides,
    },
    items: [
      { kind: "incluso", title: "Cobertura de casamento", description: "8 horas", quantity: 1, unit: "", unitPriceCents: 1090000, sortOrder: 1 },
      { kind: "incluso", title: "Fotógrafos", description: "", quantity: 2, unit: "profissionais", unitPriceCents: 0, sortOrder: 2 },
      { kind: "opcional", title: "Álbum impresso", description: "", quantity: 1, unit: "", unitPriceCents: 80000, sortOrder: 3 },
    ],
    payments: [
      { label: "Entrada (30%)", dueDate: null, dueLabel: "", amountCents: 327000, sortOrder: 1 },
      { label: "Saldo restante", dueDate: "2027-04-10", dueLabel: "", amountCents: 763000, sortOrder: 2 },
    ],
    clientName: "Ana Souza",
    ownerName: "Pedro Henrique",
    issuedOn: "2026-11-17",
    company: {
      brandName: "NÓS Studio",
      tagline: "Sua história, nosso olhar.",
      descriptor: "Marketing, comunicação e audiovisual",
      aboutText: "Sobre a NÓS.",
      whatsapp: "",
      email: "",
      instagram: "@nosstudio.cria",
      siteUrl: "https://exemplo.com.br",
    },
  };
}

describe("visão pública da proposta", () => {
  it("monta os números do exemplo de casamento", () => {
    const p = toPublicProposal(source());
    expect(p.totalCents).toBe(1090000);
    expect(p.entry).toEqual({ cents: 327000, percent: 30 });
    expect(p.balanceCents).toBe(763000);
    expect(p.items.map((i) => i.quantityLabel)).toEqual(["", "2 profissionais"]);
    expect(p.payments[1].dueText).toBe("10/04/2027");
    expect(p.clientName).toBe("Ana & Bruno");
  });

  it("NUNCA expõe custos, margens, notas internas ou desconto não aprovado", () => {
    const src = source();
    // mesmo que alguém anexe custos ao objeto de origem, eles não podem atravessar
    const tainted = { ...src, costs: [{ category: "equipe", description: "Freelancer", amountCents: SECRET_COST }] } as ProposalSource;
    const json = JSON.stringify(toPublicProposal(tainted));
    for (const secret of [SECRET_NOTE, SECRET_OVERHEAD, SECRET_TAX, SECRET_MARGIN, SECRET_DISCOUNT, SECRET_COST, "Desconto em análise", "Freelancer"]) {
      expect(json).not.toContain(String(secret));
    }
    for (const key of ["internalNotes", "overheadCents", "taxPercent", "targetMarginPercent", "costs", "unitPriceCents", "discountApproved"]) {
      expect(json).not.toContain(key);
    }
  });

  it("só mostra desconto depois de aprovado", () => {
    expect(toPublicProposal(source()).discount).toBeNull();
    const p = toPublicProposal(source({ discountApproved: true, discountCents: 90000, discountLabel: "Condição de lançamento" }));
    expect(p.discount).toEqual({ label: "Condição de lançamento", cents: 90000 });
    expect(p.subtotalCents).toBe(1090000);
    expect(p.totalCents).toBe(1000000);
  });

  it("desconto pendente + parcelas calculadas com o desconto: o plano não sai (a diferença revelaria o desconto)", () => {
    // parcelas geradas quando o desconto estava "aprovado": somam total − desconto
    const discount = 123456;
    const stale = source({ discountCents: discount, discountApproved: false });
    stale.payments = [
      { label: "Entrada (30%)", dueDate: null, dueLabel: "", amountCents: 289963, sortOrder: 1 },
      { label: "Saldo restante", dueDate: "2027-04-10", dueLabel: "", amountCents: 676581, sortOrder: 2 },
    ];
    expect(stale.payments.reduce((sum, payment) => sum + payment.amountCents, 0)).toBe(1090000 - discount);
    const p = toPublicProposal(stale);
    expect(p.totalCents).toBe(1090000);
    expect(p.discount).toBeNull();
    expect(p.payments).toEqual([]);
    // nenhum número do plano antigo (nem a diferença) aparece na saída
    const json = JSON.stringify(p);
    for (const secret of [discount, 289963, 676581, 1090000 - discount]) expect(json).not.toContain(String(secret));

    // qualquer saída pública com parcelas fecha com o total — com desconto pendente, aprovado ou sem desconto
    for (const proposal of [stale, source(), source({ discountApproved: true, discountCents: 90000 })]) {
      const out = toPublicProposal(proposal);
      const sum = out.payments.reduce((total, payment) => total + payment.amountCents, 0);
      if (proposal.proposal.discountCents > 0 && !proposal.proposal.discountApproved) expect(out.payments.length === 0 || sum === out.totalCents).toBe(true);
    }
  });

  it("depois de aprovado o desconto, o mesmo plano volta a sair (fecha com o total com desconto)", () => {
    const approved = source({ discountCents: 123456, discountApproved: true });
    approved.payments = [
      { label: "Entrada (30%)", dueDate: null, dueLabel: "", amountCents: 289963, sortOrder: 1 },
      { label: "Saldo restante", dueDate: "2027-04-10", dueLabel: "", amountCents: 676581, sortOrder: 2 },
    ];
    const p = toPublicProposal(approved);
    expect(p.totalCents).toBe(1090000 - 123456);
    expect(p.payments.map((payment) => payment.amountCents)).toEqual([289963, 676581]);
  });

  it("sem desconto pendente, o plano sai como foi cadastrado (mesmo que os sócios tenham deixado a soma diferente)", () => {
    const custom = source({ discountCents: 0 });
    custom.payments = [{ label: "Sinal", dueDate: null, dueLabel: "na assinatura", amountCents: 100000, sortOrder: 1 }];
    expect(toPublicProposal(custom).payments).toEqual([{ label: "Sinal", dueText: "na assinatura", amountCents: 100000 }]);
  });

  it("só mostra preço por item quando configurado (opcionais sempre, se tiverem valor)", () => {
    const hidden = toPublicProposal(source());
    expect(hidden.items.every((i) => i.totalCents === null)).toBe(true);
    expect(hidden.optionals[0].totalCents).toBe(80000);
    const shown = toPublicProposal(source({ showItemPrices: true }));
    expect(shown.items[0].totalCents).toBe(1090000);
    expect(shown.items[1].totalCents).toBeNull(); // item incluso sem valor não vira "R$ 0,00"
  });

  it("usa o nome do cadastro quando não há nome de exibição", () => {
    expect(toPublicProposal(source({ clientDisplayName: " " })).clientName).toBe("Ana Souza");
  });

  it("gera nome de arquivo seguro", () => {
    expect(proposalFileName({ number: "2026-007", version: 2, clientName: "Ana & Bruno" })).toBe("NOS-Studio-Proposta-2026-007-v2-Ana-e-Bruno.pdf");
    expect(proposalFileName({ number: "2026-001", version: 1, clientName: "../../etc" })).toBe("NOS-Studio-Proposta-2026-001-etc.pdf");
  });
});
