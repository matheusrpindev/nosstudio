import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { SERVICE_INTERESTS, leadFieldGroup } from "@/lib/domain";
import { buildLeadRecord, leadFormSchema } from "./lead-form";
import {
  EVENT_SERVICE_OPTIONS,
  eventTypeInterest,
  knownPackageName,
  LEAD_GROUP_FIELDS,
  LEAD_HONEYPOT_FIELD,
  LEAD_MIN_FILL_MS,
  LEAD_STARTED_AT_FIELD,
  leadExtraFields,
  leadSpamSignals,
} from "./lead-form-fields";

const base = { name: "Maria da Silva", whatsapp: "(11) 98888-7777", serviceInterest: "fotografia", consent: "on" };

describe("formulário de lead", () => {
  it("aceita um envio normal, com e sem e-mail", () => {
    expect(leadFormSchema.safeParse(base).success).toBe(true);
    const parsed = leadFormSchema.safeParse({ ...base, email: " Maria@Exemplo.org " });
    expect(parsed.success && parsed.data.email).toBe("maria@exemplo.org");
  });

  it("recusa e-mail com parâmetros de mailto (bcc, cc, body, subject)", () => {
    for (const email of [
      "vitima@exemplo.org?bcc=atacante%40evil.example&body=oi",
      "vitima@exemplo.org?subject=Proposta",
      "vitima@exemplo.org&cc=x@evil.example",
      "vitima@exemplo.org,atacante@evil.example",
      "vitima@exemplo.org#x",
    ]) {
      const parsed = leadFormSchema.safeParse({ ...base, email });
      expect(parsed.success, email).toBe(false);
    }
  });
});

describe("campos condicionais do formulário de captação (briefing v2, seção 10)", () => {
  const everything = {
    ...base,
    company: "Padaria Aurora",
    objective: "Vender mais pelo Instagram",
    segment: "Alimentação",
    profile: "@padariaaurora",
    productionType: "Vídeo institucional",
    timeframe: "Março",
    eventDate: "2027-05-15",
    eventLocation: "Espaço Jardim",
    city: "Curitiba",
    message: "Oi!",
  };
  const record = (interest: string, extra: Record<string, unknown> = {}) => buildLeadRecord(leadFormSchema.parse({ ...everything, serviceInterest: interest, ...extra }));

  it("cada serviço de interesse pertence a um grupo de campos (ou a nenhum)", () => {
    const groups = Object.fromEntries(SERVICE_INTERESTS.map((interest) => [interest, leadFieldGroup(interest)]));
    expect(groups).toEqual({
      marketing: "marketing",
      redes_sociais: "marketing",
      design: "marketing",
      identidade_visual: "marketing",
      trafego: "marketing",
      pacote_mensal: "marketing",
      video: "audiovisual",
      fotografia: "audiovisual",
      eventos: "evento",
      casamentos: "evento",
      outro: null,
    });
    expect(leadFieldGroup("qualquer-coisa")).toBeNull();
    expect(leadFieldGroup(null)).toBeNull();
  });

  it("o formulário mostra só os campos do grupo: marketing → segmento e perfil; audiovisual → tipo e previsão; evento → data e local", () => {
    expect(leadExtraFields("marketing")).toEqual(["segment", "profile"]);
    expect(leadExtraFields("trafego")).toEqual(LEAD_GROUP_FIELDS.marketing);
    expect(leadExtraFields("video")).toEqual(["productionType", "timeframe"]);
    expect(leadExtraFields("eventos")).toEqual(["eventDate", "eventLocation", "city"]);
    expect(leadExtraFields("outro")).toEqual([]);
    expect(leadExtraFields("")).toEqual([]);
  });

  it("marketing: grava empresa, objetivo, segmento e perfil — e descarta os campos de audiovisual e de evento", () => {
    const lead = record("redes_sociais");
    expect(lead.details).toEqual({ company: "Padaria Aurora", objective: "Vender mais pelo Instagram", segment: "Alimentação", profile: "@padariaaurora" });
    expect(lead.eventDate).toBeNull();
    expect(lead.city).toBeNull();
  });

  it("audiovisual: grava tipo e previsão, sem segmento/perfil nem data/local", () => {
    const lead = record("fotografia");
    expect(lead.details).toEqual({ company: "Padaria Aurora", objective: "Vender mais pelo Instagram", productionType: "Vídeo institucional", timeframe: "Março" });
    expect(lead.eventDate).toBeNull();
  });

  it("evento: grava data, local e cidade, sem os campos dos outros grupos", () => {
    const lead = record("eventos");
    expect(lead.eventDate).toBe("2027-05-15");
    expect(lead.city).toBe("Curitiba");
    expect(lead.details).toEqual({ company: "Padaria Aurora", objective: "Vender mais pelo Instagram", eventLocation: "Espaço Jardim" });
  });

  it("“ainda não sei”: só os campos comuns", () => {
    const lead = record("outro");
    expect(lead.details).toEqual({ company: "Padaria Aurora", objective: "Vender mais pelo Instagram" });
    expect(lead.eventDate).toBeNull();
    expect(lead.city).toBeNull();
  });

  it("campos vazios não viram chave no lead", () => {
    const lead = buildLeadRecord(leadFormSchema.parse({ ...base, serviceInterest: "marketing", segment: "  " }));
    expect(lead.details).toEqual({});
  });
});

describe("formulário de Eventos e Casamentos (briefing v2, seção 09)", () => {
  const event = {
    name: "Ana e Bruno",
    whatsapp: "(41) 99999-0000",
    email: "ana@exemplo.org",
    consent: "on",
    eventType: "Casamento",
    eventDate: "2027-09-18",
    startTime: "16:30",
    city: "Curitiba",
    eventLocation: "Chácara Bela Vista",
    guests: "101 a 200",
    services: ["Fotografia", "Filmagem", "Algo que não existe", "Making of"],
    message: "Cerimônia ao ar livre.",
    segment: "não deveria entrar",
  };

  it("o tipo de evento decide o interesse gravado (o campo de serviço nem existe neste formulário)", () => {
    expect(eventTypeInterest("Casamento")).toBe("casamentos");
    expect(eventTypeInterest("Evento corporativo")).toBe("eventos");
    expect(eventTypeInterest("Evento social")).toBe("eventos");
    expect(eventTypeInterest("Outro")).toBe("eventos");
    expect(eventTypeInterest("")).toBe("eventos");
    expect(buildLeadRecord(leadFormSchema.parse(event)).serviceInterest).toBe("casamentos");
    expect(buildLeadRecord(leadFormSchema.parse({ ...event, eventType: "Evento corporativo", serviceInterest: "marketing" })).serviceInterest).toBe("eventos");
  });

  it("grava tipo, data, horário, cidade, local, convidados e serviços (só opções conhecidas, na ordem da lista)", () => {
    const lead = buildLeadRecord(leadFormSchema.parse(event));
    expect(lead.eventDate).toBe("2027-09-18");
    expect(lead.city).toBe("Curitiba");
    expect(lead.details).toEqual({
      eventType: "Casamento",
      eventLocation: "Chácara Bela Vista",
      guests: "101 a 200",
      startTime: "16:30",
      services: "Fotografia, Filmagem, Making of",
    });
  });

  it("um só serviço marcado chega como texto (não como lista) e continua valendo", () => {
    const parsed = leadFormSchema.parse({ ...event, services: "Storymaker" });
    expect(parsed.services).toEqual(["Storymaker"]);
    expect(leadFormSchema.parse({ ...event, services: undefined }).services).toEqual([]);
    expect(EVENT_SERVICE_OPTIONS).toContain("Storymaker");
  });

  it("horário inválido é recusado", () => {
    expect(leadFormSchema.safeParse({ ...event, startTime: "25:99" }).success).toBe(false);
  });
});

describe("knownPackageName (?pacote= da URL)", () => {
  const published = ["Começo", "Presença", "Destaque", "Ensaio fotográfico"];


  it("aceita só o nome exato de um pacote publicado", () => {
    expect(knownPackageName("Presença", published)).toBe("Presença");
    expect(knownPackageName("  Ensaio fotográfico ", published)).toBe("Ensaio fotográfico");
  });

  it("ignora texto arbitrário, HTML e fórmulas", () => {
    for (const value of [
      "Promoção: 50% hoje, chame 11 9XXXX-XXXX",
      "<img src=x onerror=alert(1)> PROMO falsa",
      '=HYPERLINK("http://evil")',
      "presença",
      "Presença 2",
      "",
      null,
      undefined,
    ]) {
      expect(knownPackageName(value, published)).toBe("");
    }
    expect(knownPackageName("Presença", [])).toBe("");
  });
});

describe("sinais anti-spam do envio", () => {
  const NOW = 1_800_000_000_000;
  const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  };

  it("campo-isca preenchido é robô; vazio ou só espaços, não", () => {
    expect(leadSpamSignals(form({ [LEAD_HONEYPOT_FIELD]: "ACME Ltda" }), NOW).honeypot).toBe(true);
    expect(leadSpamSignals(form({ [LEAD_HONEYPOT_FIELD]: "  " }), NOW).honeypot).toBe(false);
    expect(leadSpamSignals(form({}), NOW).honeypot).toBe(false);
  });

  it("envio rápido demais é só um sinal (não descarta) — e sem JavaScript não há o que medir", () => {
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - 500) }), NOW)).toEqual({ honeypot: false, tooFast: true });
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - LEAD_MIN_FILL_MS) }), NOW).tooFast).toBe(false);
    expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: String(NOW - 60_000) }), NOW).tooFast).toBe(false);
    for (const value of ["", "abc", "0", "-5"]) expect(leadSpamSignals(form({ [LEAD_STARTED_AT_FIELD]: value }), NOW).tooFast).toBe(false);
    expect(leadSpamSignals(form({}), NOW).tooFast).toBe(false);
  });
});

describe("o navegador não recebe o zod por causa do formulário", () => {
  const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

  it("lead-form-fields.ts só importa o vocabulário de domínio (arquivo puro, sem dependências)", () => {
    const imports = read("src/lib/site/lead-form-fields.ts").match(/^import .*$/gm) ?? [];
    expect(imports).toEqual(['import { leadFieldGroup, type LeadFieldGroup, type ServiceInterest } from "@/lib/domain";']);
    expect(read("src/lib/domain.ts")).not.toMatch(/^import /m);
  });

  it("os componentes do site importam só o arquivo de campos, nunca o schema", () => {
    for (const file of ["src/components/site/lead-form.tsx", "src/components/site/contact-package-notice.tsx"]) {
      const source = read(file);
      expect(source, file).toContain('"@/lib/site/lead-form-fields"');
      expect(source, file).not.toMatch(/from "@\/lib\/site\/lead-form"/);
      expect(source, file).not.toMatch(/from "zod"/);
    }
  });
});
