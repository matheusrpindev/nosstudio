import { describe, expect, it } from "vitest";
import { clientNumbers, internalNumbers, paymentsDifferenceCents, suggestPayments } from "./calc";

const weddingItems = [
  { kind: "incluso" as const, quantity: 1, unitPriceCents: 1090000 },
  { kind: "incluso" as const, quantity: 2, unitPriceCents: 0 },
  { kind: "opcional" as const, quantity: 1, unitPriceCents: 80000 },
];
const base = { items: weddingItems, discountCents: 0, discountApproved: false, entryMode: "percentual" as const, entryPercent: 30, entryCents: 0 };

describe("números do cliente", () => {
  it("reproduz o exemplo de casamento do briefing: R$ 10.900, entrada de 30%", () => {
    const n = clientNumbers(base);
    expect(n.totalCents).toBe(1090000);
    expect(n.entryCents).toBe(327000);
    expect(n.balanceCents).toBe(763000);
    expect(n.optionalsTotalCents).toBe(80000);
  });

  it("ignora desconto enquanto não aprovado e aplica depois de aprovado", () => {
    expect(clientNumbers({ ...base, discountCents: 90000 }).totalCents).toBe(1090000);
    const approved = clientNumbers({ ...base, discountCents: 90000, discountApproved: true });
    expect(approved.discountCents).toBe(90000);
    expect(approved.totalCents).toBe(1000000);
    expect(approved.entryCents).toBe(300000);
  });

  it("nunca deixa o total negativo nem o sinal maior que o total", () => {
    const n = clientNumbers({ ...base, discountCents: 99999999, discountApproved: true, entryMode: "valor", entryCents: 5000000 });
    expect(n.totalCents).toBe(0);
    expect(n.entryCents).toBe(0);
    const fixed = clientNumbers({ ...base, entryMode: "valor", entryCents: 5000000 });
    expect(fixed.entryCents).toBe(1090000);
    expect(fixed.balanceCents).toBe(0);
  });

  it("calcula o percentual quando o sinal é informado em valor", () => {
    const n = clientNumbers({ ...base, entryMode: "valor", entryCents: 545000 });
    expect(n.entryPercent).toBe(50);
  });
});

describe("números internos", () => {
  const input = { totalCents: 1090000, costs: [{ amountCents: 400000 }, { amountCents: 100000 }], overheadCents: 50000, taxPercent: 6, targetMarginPercent: 40 };

  it("custo total = custo direto + rateio + tributos", () => {
    const n = internalNumbers(input);
    expect(n.directCostCents).toBe(500000);
    expect(n.taxCents).toBe(65400);
    expect(n.totalCostCents).toBe(615400);
    expect(n.profitCents).toBe(474600);
  });

  it("distingue margem de markup", () => {
    const n = internalNumbers(input);
    expect(n.contributionMarginPercent).toBe(48.1); // (10.900 − 5.000 − 654) ÷ 10.900
    expect(n.netMarginPercent).toBe(43.5); // 4.746 ÷ 10.900
    expect(n.markupPercent).toBe(77.1); // 4.746 ÷ 6.154
    expect(n.belowTarget).toBe(false);
  });

  it("sugere o preço para a margem-alvo", () => {
    const n = internalNumbers({ ...input, targetMarginPercent: 50 });
    expect(n.belowTarget).toBe(true);
    expect(n.suggestedPriceCents).toBe(1250000); // 5.500 ÷ (1 − 0,06 − 0,50)
    const check = internalNumbers({ ...input, totalCents: n.suggestedPriceCents!, targetMarginPercent: 50 });
    expect(check.netMarginPercent).toBe(50);
  });

  it("não divide por zero", () => {
    const n = internalNumbers({ totalCents: 0, costs: [], overheadCents: 0, taxPercent: 0, targetMarginPercent: 0 });
    expect(n.netMarginPercent).toBeNull();
    expect(n.markupPercent).toBeNull();
    expect(n.belowTarget).toBeNull();
    expect(n.suggestedPriceCents).toBeNull();
    expect(internalNumbers({ ...input, taxPercent: 60, targetMarginPercent: 50 }).suggestedPriceCents).toBeNull();
  });
});

describe("plano de pagamento", () => {
  it("entrada + saldo único", () => {
    const lines = suggestPayments({ totalCents: 1090000, entryCents: 327000, entryPercent: 30 }, 1);
    expect(lines).toEqual([
      { label: "Entrada (30%)", amountCents: 327000 },
      { label: "Saldo restante", amountCents: 763000 },
    ]);
  });

  it("parcelas fecham exatamente com o total", () => {
    const lines = suggestPayments({ totalCents: 1000000, entryCents: 300000, entryPercent: 30 }, 3);
    expect(lines.map((l) => l.amountCents)).toEqual([300000, 233333, 233333, 233334]);
    expect(paymentsDifferenceCents(lines, 1000000)).toBe(0);
  });

  it("sem entrada", () => {
    expect(suggestPayments({ totalCents: 50000, entryCents: 0, entryPercent: 0 }, 1)).toEqual([{ label: "Pagamento único", amountCents: 50000 }]);
  });
});
