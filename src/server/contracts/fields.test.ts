import { describe, expect, it } from "vitest";
import { toPublicProposal, type ProposalSource } from "@/lib/proposals/public";
import { buildContractFieldValues, CONTRACT_FIELDS, fillContractFields, findUnfilledFields, unfilledFieldsSummary, type ContractFieldSource } from "./fields";

const client = { name: "Ana Souza", contactName: "Ana", document: "12345678901", email: "ana@exemplo.org", whatsapp: "31988887777", city: "Belo Horizonte" };

/** Proposta com tudo que NÃO pode sair do painel: custo interno, margem, nota interna e desconto não aprovado. */
function proposalSource(overrides: Partial<ProposalSource["proposal"]> = {}): ProposalSource {
  return {
    proposal: {
      number: "2026-007",
      version: 1,
      modality: "casamento",
      title: "Cobertura de casamento",
      clientDisplayName: "Ana & Bruno",
      contactName: "Ana (noiva)",
      eventDate: "2027-03-20",
      eventLocation: "Espaço Villa, Belo Horizonte",
      validUntil: "2026-12-10",
      intro: "",
      scheduleText: "",
      exclusions: "",
      paymentNotes: "",
      conditions: "",
      discountCents: 77_700,
      discountLabel: "Desconto de indicação",
      discountApproved: false,
      showItemPrices: false,
      entryMode: "percentual",
      entryPercent: 30,
      entryCents: 0,
      internalNotes: "SEGREDO-NOTA-INTERNA",
      overheadCents: 13_131,
      taxPercent: 6.66,
      targetMarginPercent: 41.41,
      ...overrides,
    },
    items: [
      { kind: "incluso", title: "Foto e filme", description: "", quantity: 1, unit: "", unitPriceCents: 800_000, sortOrder: 1 },
      { kind: "opcional", title: "Drone", description: "", quantity: 1, unit: "", unitPriceCents: 90_000, sortOrder: 2 },
    ],
    payments: [
      { label: "Entrada (30%)", dueDate: "2026-12-01", dueLabel: "", amountCents: 240_000, sortOrder: 1 },
      { label: "Saldo restante", dueDate: null, dueLabel: "até 7 dias antes do evento", amountCents: 560_000, sortOrder: 2 },
    ],
    clientName: "Ana Souza",
    ownerName: "Laura",
    issuedOn: "2026-11-18",
    company: { brandName: "NÓS Studio", tagline: "", descriptor: "", aboutText: "", whatsapp: "", email: "", instagram: "", siteUrl: "" },
  };
}

const fullSource = (overrides: Partial<ProposalSource["proposal"]> = {}): ContractFieldSource => ({
  client,
  proposal: toPublicProposal(proposalSource(overrides)),
  project: { title: "Casamento Ana e Bruno", eventDate: "2027-03-21", location: "Outro lugar" },
  today: "2026-11-18",
});

describe("fillContractFields", () => {
  const values = buildContractFieldValues(fullSource());

  it("troca os campos conhecidos pelos dados formatados", () => {
    const text = "CONTRATANTE: {{cliente}}, CPF/CNPJ {{documento}}, e-mail {{email}}, WhatsApp {{whatsapp}}. Serviço: {{servico}} em {{data_evento}}, {{local_evento}}. Valor: {{valor_total}}, entrada de {{entrada}} e saldo de {{saldo}}. {{cidade}}, {{data_hoje}}.";
    expect(fillContractFields(text, values)).toBe(
      "CONTRATANTE: Ana Souza, CPF/CNPJ 123.456.789-01, e-mail ana@exemplo.org, WhatsApp (31) 98888-7777. Serviço: Cobertura de casamento em 20/03/2027, Espaço Villa, Belo Horizonte. Valor: R$ 8.000,00, entrada de R$ 2.400,00 e saldo de R$ 5.600,00. Belo Horizonte, 18/11/2026.",
    );
  });

  it("aceita espaços, maiúsculas e acentos no nome do campo", () => {
    expect(fillContractFields("{{ Cliente }} / {{SERVIÇO}} / {{data-evento}} / {{Data Hoje Extenso}}", values)).toBe("Ana Souza / Cobertura de casamento / 20/03/2027 / 18 de novembro de 2026");
  });

  it("campo desconhecido fica como está", () => {
    expect(fillContractFields("Foro: {{foro}} · {{cliente}} · {{ testemunha 1 }}", values)).toBe("Foro: {{foro}} · Ana Souza · {{ testemunha 1 }}");
  });

  it("dado ausente fica como está, para preencher à mão", () => {
    const partial = buildContractFieldValues({ client: { ...client, document: "", email: "  " }, proposal: null, project: null, today: "2026-11-18" });
    const text = "{{cliente}} — {{documento}} — {{email}} — {{valor_total}} — {{entrada}} — {{data_evento}} — {{parcelas}} — {{data_hoje}}";
    expect(fillContractFields(text, partial)).toBe("Ana Souza — {{documento}} — {{email}} — {{valor_total}} — {{entrada}} — {{data_evento}} — {{parcelas}} — 18/11/2026");
  });

  it("sem nenhum vínculo, só a data de hoje é preenchida", () => {
    const empty = buildContractFieldValues({ client: null, proposal: null, project: null, today: "2026-11-18" });
    expect(Object.keys(empty).sort()).toEqual(["data_hoje", "data_hoje_extenso"]);
    expect(fillContractFields("{{cliente}} {{whatsapp}} {{data_hoje}}", empty)).toBe("{{cliente}} {{whatsapp}} 18/11/2026");
  });

  it("não expande de novo um valor que contenha chaves, nem interpreta `$` do valor", () => {
    const tricky = buildContractFieldValues({ client: { ...client, name: "{{valor_total}} $& $1" }, proposal: fullSource().proposal, project: null, today: "2026-11-18" });
    expect(fillContractFields("{{cliente}}", tricky)).toBe("{{valor_total}} $& $1");
  });

  it("texto sem campos volta igual", () => {
    const text = "Cláusula 1ª — sem campos, com {chaves simples} e [COLCHETES].";
    expect(fillContractFields(text, values)).toBe(text);
  });
});

describe("buildContractFieldValues", () => {
  it("usa o projeto quando a proposta não tem data/local, e o título do projeto quando não há proposta", () => {
    const semEvento = buildContractFieldValues(fullSource({ eventDate: null, eventLocation: "" }));
    expect(semEvento.data_evento).toBe("21/03/2027");
    expect(semEvento.local_evento).toBe("Outro lugar");
    const semProposta = buildContractFieldValues({ ...fullSource(), proposal: null });
    expect(semProposta.servico).toBe("Casamento Ana e Bruno");
    expect(semProposta.projeto).toBe("Casamento Ana e Bruno");
    expect(semProposta.valor_total).toBeUndefined();
    expect(semProposta.proposta).toBeUndefined();
  });

  it("lista as parcelas com valor e vencimento, e cita a versão da proposta", () => {
    const values = buildContractFieldValues(fullSource({ version: 2, discountCents: 0 }));
    expect(values.proposta).toBe("2026-007 v2");
    expect(values.parcelas).toBe("- Entrada (30%): R$ 2.400,00 — 01/12/2026\n- Saldo restante: R$ 5.600,00 — até 7 dias antes do evento");
  });

  it("formata CNPJ e mantém documento fora do padrão como veio", () => {
    const cnpj = buildContractFieldValues({ client: { ...client, document: "12.345.678/0001-90" }, proposal: null, project: null, today: "2026-11-18" });
    expect(cnpj.documento).toBe("12.345.678/0001-90");
    const odd = buildContractFieldValues({ client: { ...client, document: "RG 1234" }, proposal: null, project: null, today: "2026-11-18" });
    expect(odd.documento).toBe("RG 1234");
  });

  it("proposta sem preço não preenche valores (ficam para completar à mão)", () => {
    const source = proposalSource({ discountCents: 0 });
    source.items = [];
    source.payments = [];
    const values = buildContractFieldValues({ client, proposal: toPublicProposal(source), project: null, today: "2026-11-18" });
    expect(values.valor_total).toBeUndefined();
    expect(values.entrada).toBeUndefined();
    expect(values.saldo).toBeUndefined();
    expect(values.parcelas).toBeUndefined();
  });

  it("SEGURANÇA: desconto não aprovado, custos, margem e nota interna nunca entram nos campos", () => {
    // desconto pendente de 777,00 sobre 8.000,00; parcelas que fecham com o total SEM desconto
    const pending = buildContractFieldValues(fullSource());
    expect(pending.valor_total).toBe("R$ 8.000,00");
    expect(pending.entrada).toBe("R$ 2.400,00");
    const everything = Object.values(pending).join(" | ");
    for (const secret of ["777,00", "7.223", "SEGREDO", "131,31", "6,66", "41,41", "Desconto de indicação"]) expect(everything).not.toContain(secret);

    // parcelas calculadas JÁ com o desconto pendente entregariam o valor: a visão pública as omite, e o campo fica por preencher
    const source = proposalSource();
    source.payments = [{ label: "À vista", dueDate: null, dueLabel: "", amountCents: 722_300, sortOrder: 1 }];
    const hidden = buildContractFieldValues({ client, proposal: toPublicProposal(source), project: null, today: "2026-11-18" });
    expect(hidden.parcelas).toBeUndefined();
    expect(Object.values(hidden).join(" | ")).not.toContain("7.223");

    // aprovado, o desconto passa a valer — como no PDF
    const approved = buildContractFieldValues(fullSource({ discountApproved: true }));
    expect(approved.valor_total).toBe("R$ 7.223,00");
  });

  it("todo campo da lista de ajuda tem valor quando há cliente, proposta e projeto completos", () => {
    const values = buildContractFieldValues(fullSource({ discountCents: 0 }));
    for (const field of CONTRACT_FIELDS) expect(values[field.key], field.key).toBeTruthy();
  });
});

describe("findUnfilledFields", () => {
  it("lista o que sobrou, sem repetir, separando campo conhecido de desconhecido", () => {
    const text = "{{documento}} … {{ Documento }} … {{foro}} … {{data_evento}} … {{foro}}";
    expect(findUnfilledFields(text)).toEqual([
      { token: "{{documento}}", known: true },
      { token: "{{foro}}", known: false },
      { token: "{{data_evento}}", known: true },
    ]);
    expect(findUnfilledFields("Texto pronto, com {chaves simples}.")).toEqual([]);
  });

  it("resume em uma frase para os avisos", () => {
    expect(unfilledFieldsSummary([])).toBe("");
    expect(unfilledFieldsSummary([{ token: "{{documento}}", known: true }])).toBe("Falta preencher 1 campo: {{documento}}.");
    expect(unfilledFieldsSummary(findUnfilledFields("{{documento}} {{foro}}"))).toBe("Falta preencher 2 campos: {{documento}}, {{foro}}.");
  });
});
