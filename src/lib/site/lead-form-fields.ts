/**
 * Formulário público de contato/orçamento — constantes, tipos e helpers SEM dependências (nada de zod aqui).
 * É o que o componente do navegador (`src/components/site/lead-form.tsx`) importa; o schema de validação, que
 * só roda no servidor, fica em ./lead-form.ts. Manter os dois separados evita mandar o zod inteiro (~30 KB)
 * para o visitante.
 *
 * Nomes dos campos (FormData): name, whatsapp, email, serviceInterest, eventDate, city, message, consent,
 * originPath + extras de evento: eventType, eventLocation, guests, startTime, endTime, coverage, storymaker,
 * packageName. Mais os dois campos anti-spam abaixo.
 */

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
 * O pacote/serviço de origem (`?pacote=…` na URL do formulário) só vale se for o nome de um pacote publicado.
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

/** Opções do campo "cobertura" do formulário de evento. */
export const EVENT_COVERAGE_OPTIONS = ["Foto", "Vídeo", "Foto e vídeo", "Ainda não sei"] as const;
export const EVENT_STORYMAKER_OPTIONS = ["Sim", "Não", "Talvez"] as const;
export const EVENT_GUEST_OPTIONS = ["Até 50", "51 a 100", "101 a 200", "Mais de 200", "Ainda não sei"] as const;
