/**
 * Formulário público de contato/orçamento — constantes, tipos e helpers SEM dependências (nada de zod aqui).
 * É o que o componente do navegador (`src/components/site/lead-form.tsx`) importa; o schema de validação, que
 * só roda no servidor, fica em ./lead-form.ts. Manter os dois separados evita mandar o zod inteiro (~30 KB)
 * para o visitante.
 *
 * Nomes dos campos (FormData): name, company, whatsapp, email, serviceInterest, objective, message, consent,
 * originPath, packageName + os campos conforme o tipo do pedido (`LEAD_GROUP_FIELDS`) + os do formulário de
 * evento: eventType, eventDate, startTime, endTime, city, eventLocation, guests, services[]. Mais os dois campos
 * anti-spam abaixo.
 */
import { leadFieldGroup, type LeadFieldGroup, type ServiceInterest } from "@/lib/domain";

/**
 * Campo-isca: fica fora da tela e do teclado (tabindex -1, aria-hidden, autocomplete off).
 * Pessoas não o preenchem; robôs que preenchem tudo, sim — e são descartados em silêncio.
 */
export const LEAD_HONEYPOT_FIELD = "empresa_site";
/** Momento (Date.now()) em que o formulário apareceu, preenchido por JS. */
export const LEAD_STARTED_AT_FIELD = "startedAt";
/**
 * Envio mais rápido que isto é só um SINAL de possível automação: o pedido é gravado mesmo assim (uma pessoa
 * com preenchimento automático consegue ser rápida) e fica marcado no painel para os sócios conferirem.
 */
export const LEAD_MIN_FILL_MS = 2500;

/** Sinais anti-spam de um envio. `honeypot`: descartar em silêncio. `tooFast`: gravar, mas sinalizar no painel. */
export function leadSpamSignals(formData: FormData, now: number): { honeypot: boolean; tooFast: boolean } {
  const trap = formData.get(LEAD_HONEYPOT_FIELD);
  const startedAt = Number(formData.get(LEAD_STARTED_AT_FIELD));
  return {
    honeypot: typeof trap === "string" && trap.trim() !== "",
    // sem JavaScript o campo vem vazio (0): não dá para medir, então não é sinal de nada
    tooFast: Number.isFinite(startedAt) && startedAt > 0 && now - startedAt < LEAD_MIN_FILL_MS,
  };
}

/**
 * Campos adicionais do formulário de captação conforme o tipo do pedido (briefing v2, seção 10). O formulário só
 * mostra os do grupo do serviço escolhido e o servidor só grava esses (`buildLeadDetails` em ./lead-form.ts).
 */
export const LEAD_GROUP_FIELDS: Record<LeadFieldGroup, readonly string[]> = {
  marketing: ["segment", "profile"],
  audiovisual: ["productionType", "timeframe"],
  evento: ["eventDate", "eventLocation", "city"],
};

/** Campos adicionais que o formulário mostra para um serviço de interesse (vazio = só os campos comuns). */
export function leadExtraFields(interest: string | null | undefined): readonly string[] {
  const group = leadFieldGroup(interest);
  return group ? LEAD_GROUP_FIELDS[group] : [];
}

/** Tipos de evento do formulário de Eventos e Casamentos e o interesse que cada um grava no lead. */
export const EVENT_TYPE_OPTIONS = ["Casamento", "Evento corporativo", "Evento social", "Outro"] as const;
export function eventTypeInterest(eventType: string | null | undefined): ServiceInterest {
  return (eventType ?? "").trim().toLocaleLowerCase("pt-BR").startsWith("casamento") ? "casamentos" : "eventos";
}

/** Serviços que a pessoa pode marcar no formulário de evento (formatos de cobertura do briefing). */
export const EVENT_SERVICE_OPTIONS = [
  "Fotografia",
  "Filmagem",
  "Storymaker",
  "Conteúdo em tempo real",
  "Melhores momentos",
  "Pré-wedding",
  "Making of",
  "Teaser",
  "Galeria digital",
] as const;

/**
 * O plano/serviço de origem (`?pacote=…` na URL do formulário) só vale se for o nome de um plano, serviço avulso
 * ou serviço publicado.
 * Qualquer outro texto é ignorado: senão um link do próprio site exibiria uma frase arbitrária ("Pedido sobre:
 * promoção falsa…") com a identidade da NÓS e a gravaria no lead. Devolve o nome oficial ou "".
 */
export function knownPackageName(value: string | null | undefined, publishedNames: readonly string[]): string {
  const wanted = (value ?? "").trim();
  if (!wanted) return "";
  return publishedNames.find((name) => name.trim() === wanted)?.trim() ?? "";
}

/** O que a action devolve em caso de sucesso (para a tela de confirmação). */
export type LeadSuccess = {
  title: string;
  text: string;
  /** Link de WhatsApp com mensagem pronta para continuar a conversa (nulo se não houver número configurado). */
  whatsappUrl: string | null;
};

export const EVENT_GUEST_OPTIONS = ["Até 50", "51 a 100", "101 a 200", "Mais de 200", "Ainda não sei"] as const;
