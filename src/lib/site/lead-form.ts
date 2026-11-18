/**
 * Schema de validação do formulário público de contato/orçamento (e da variante de evento/casamento).
 * Roda no SERVIDOR (`submitLeadAction`). Componentes do navegador não importam este arquivo (ele carrega o zod):
 * constantes, tipos e helpers sem dependências ficam em ./lead-form-fields.ts.
 */
import { z } from "zod";
import { isISODate, isTime } from "@/lib/dates";
import { SERVICE_INTERESTS } from "@/lib/domain";
import { isValidEmail, isValidPhone } from "@/lib/format";

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
  coverage: optionalText(60),
  storymaker: optionalText(60),
  /** Pacote ou serviço avulso de origem, quando o visitante veio de um card. */
  packageName: optionalText(120),
});

export type LeadFormData = z.infer<typeof leadFormSchema>;
