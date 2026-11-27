/**
 * Schema de validação do formulário público de contato/orçamento (e da variante de evento/casamento).
 * Roda no SERVIDOR (`submitLeadAction`). Componentes do navegador não importam este arquivo (ele carrega o zod):
 * constantes, tipos e helpers sem dependências ficam em ./lead-form-fields.ts.
 */
import { z } from "zod";
import { isISODate, isTime } from "@/lib/dates";
import type { LeadDetails } from "@/db/schema";
import { leadFieldGroup, SERVICE_INTERESTS } from "@/lib/domain";
import { isValidEmail, isValidPhone } from "@/lib/format";
import { EVENT_SERVICE_OPTIONS, eventTypeInterest } from "./lead-form-fields";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((value) => value ?? "");

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Conte para a gente o seu nome.").max(120, "Nome muito longo."),
  whatsapp: z
    .string()
    .trim()
    .max(30, "Número muito longo.")
    .refine(isValidPhone, "Informe um WhatsApp com DDD, por exemplo (11) 91234-5678."),
  email: optionalText(160)
    .transform((value) => value.toLowerCase())
    // `isValidEmail` recusa `?`, `&`, `%`… — o e-mail vira link `mailto:` no painel e não pode carregar parâmetros
    .refine((value) => value === "" || isValidEmail(value), "Confira o e-mail informado."),
  serviceInterest: z.enum(SERVICE_INTERESTS, "Escolha uma das opções.").optional().default("outro"),
  eventDate: optionalText(10)
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isISODate(value), "Data inválida."),
  city: optionalText(120),
  message: optionalText(2000),
  consent: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "on" || value === "true")
    .refine((value) => value, "Para enviar, é preciso concordar com o uso dos seus dados."),
  /** Página de origem — só caminhos internos. */
  originPath: optionalText(200).transform((value) => (/^\/(?!\/)[\w\-/#?=&.%]*$/.test(value) ? value : "")),
  // extras do formulário de evento/casamento
  eventType: optionalText(120),
  eventLocation: optionalText(160),
  guests: optionalText(60),
  startTime: optionalText(5).refine((value) => value === "" || isTime(value), "Horário inválido."),
  endTime: optionalText(5).refine((value) => value === "" || isTime(value), "Horário inválido."),
  /** Serviços marcados no formulário de evento: só as opções conhecidas entram. */
  services: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      const picked = (Array.isArray(value) ? value : value ? [value] : []).map((item) => item.trim());
      return EVENT_SERVICE_OPTIONS.filter((option) => picked.includes(option));
    }),
  // captação comercial (briefing v2, seção 10)
  company: optionalText(120),
  objective: optionalText(300),
  segment: optionalText(120),
  profile: optionalText(160),
  productionType: optionalText(160),
  timeframe: optionalText(120),
  /** Plano, serviço avulso ou serviço de origem, quando o visitante veio de um botão do site. */
  packageName: optionalText(120),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

/**
 * O que um envio validado grava no lead. Regras (briefing v2, seções 09 e 10):
 * - formulário de evento (tem "tipo de evento"): o tipo decide o interesse — Casamento → casamentos; os demais →
 *   eventos — e os campos de evento entram todos;
 * - nos outros formulários, só entram os campos adicionais DO TIPO do serviço escolhido (marketing: segmento e
 *   perfil; audiovisual: tipo e previsão; evento: data, local e cidade). Um campo de outro tipo que venha no
 *   envio (trocou o serviço depois de preencher, ou envio forjado) é descartado;
 * - empresa, objetivo e plano/serviço de origem valem para qualquer tipo.
 */
export function buildLeadRecord(data: LeadFormData): {
  serviceInterest: LeadFormData["serviceInterest"];
  eventDate: string | null;
  city: string | null;
  details: LeadDetails;
} {
  const isEventForm = data.eventType !== "";
  const serviceInterest = isEventForm ? eventTypeInterest(data.eventType) : data.serviceInterest;
  const group = leadFieldGroup(serviceInterest);
  const details: LeadDetails = {};
  const put = (key: Exclude<keyof LeadDetails, "extras">, value: string) => {
    if (value) details[key] = value;
  };

  put("company", data.company);
  put("objective", data.objective);
  put("packageName", data.packageName);
  if (group === "marketing") {
    put("segment", data.segment);
    put("profile", data.profile);
  }
  if (group === "audiovisual") {
    put("productionType", data.productionType);
    put("timeframe", data.timeframe);
  }
  if (group === "evento") {
    put("eventType", data.eventType);
    put("eventLocation", data.eventLocation);
    put("guests", data.guests);
    put("startTime", data.startTime);
    put("endTime", data.endTime);
    put("services", data.services.join(", "));
  }
  return {
    serviceInterest,
    eventDate: group === "evento" ? data.eventDate : null,
    city: group === "evento" && data.city ? data.city : null,
    details,
  };
}
