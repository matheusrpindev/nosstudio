/**
 * Formulário público de contato/orçamento (e a variante de evento/casamento).
 * Arquivo puro: o mesmo schema valida no navegador e no servidor.
 *
 * Nomes dos campos (FormData): name, whatsapp, email, serviceInterest, eventDate, city, message, consent,
 * originPath + extras de evento: eventType, eventLocation, guests, startTime, endTime, coverage, storymaker,
 * packageName. Mais os dois campos anti-spam abaixo.
 */
import { z } from "zod";
import { isISODate, isTime } from "@/lib/dates";
import { SERVICE_INTERESTS } from "@/lib/domain";
import { isValidPhone } from "@/lib/format";

/**
 * Campo-isca: fica fora da tela e do teclado (tabindex -1, aria-hidden, autocomplete off).
 * Pessoas não o preenchem; robôs que preenchem tudo, sim — e são descartados em silêncio.
 */
export const LEAD_HONEYPOT_FIELD = "empresa_site";
/** Momento (Date.now()) em que o formulário apareceu, preenchido por JS. Envio rápido demais = robô. */
export const LEAD_STARTED_AT_FIELD = "startedAt";
export const LEAD_MIN_FILL_MS = 2500;

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
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value), "Confira o e-mail informado."),
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
  coverage: optionalText(60),
  storymaker: optionalText(60),
  /** Pacote ou serviço avulso de origem, quando o visitante veio de um card. */
  packageName: optionalText(120),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;

/** O que a action devolve em caso de sucesso (para a tela de confirmação). */
export type LeadSuccess = {
  title: string;
  text: string;
  /** Link de WhatsApp com mensagem pronta para continuar a conversa (nulo se não houver número configurado). */
  whatsappUrl: string | null;
};

/** Opções do campo "cobertura" do formulário de evento. */
export const EVENT_COVERAGE_OPTIONS = ["Foto", "Vídeo", "Foto e vídeo", "Ainda não sei"] as const;
export const EVENT_STORYMAKER_OPTIONS = ["Sim", "Não", "Talvez"] as const;
export const EVENT_GUEST_OPTIONS = ["Até 50", "51 a 100", "101 a 200", "Mais de 200", "Ainda não sei"] as const;
