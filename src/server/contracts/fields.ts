/**
 * Campos automáticos dos modelos de contrato — lógica pura (sem banco), coberta por `fields.test.ts`.
 *
 * No texto do modelo, um campo é escrito entre chaves duplas: `{{cliente}}`, `{{valor_total}}`… Ao criar o contrato,
 * cada campo é trocado pelo dado do cliente, da proposta ou do projeto escolhidos. Duas regras:
 *  - campo desconhecido ou sem dado no cadastro FICA COMO ESTÁ no texto, para ser preenchido à mão (a tela avisa);
 *  - da proposta só entram os números PÚBLICOS (`PublicProposal`, a mesma visão do PDF): nunca custo, margem,
 *    nota interna nem desconto não aprovado.
 */
import { formatDate, formatDateLong, type ISODate } from "@/lib/dates";
import { formatBRL, formatPhone, onlyDigits } from "@/lib/format";
import type { PublicProposal } from "@/lib/proposals/public";

/** Campos disponíveis, na ordem em que aparecem na ajuda do editor de modelo. */
export const CONTRACT_FIELDS = [
  { key: "cliente", description: "Nome do cliente ou da empresa, como está no cadastro." },
  { key: "contato", description: "Pessoa de contato do cliente." },
  { key: "documento", description: "CPF ou CNPJ do cliente." },
  { key: "email", description: "E-mail do cliente." },
  { key: "whatsapp", description: "WhatsApp do cliente, com DDD." },
  { key: "cidade", description: "Cidade do cliente." },
  { key: "servico", description: "Título da proposta (ou do projeto, se não houver proposta)." },
  { key: "proposta", description: "Número da proposta, ex.: 2026-007." },
  { key: "valor_total", description: "Total da proposta ao cliente (o mesmo do PDF)." },
  { key: "entrada", description: "Valor do sinal / entrada da proposta." },
  { key: "saldo", description: "Total da proposta menos a entrada." },
  { key: "parcelas", description: "Parcelas da proposta, uma por linha, com valor e vencimento." },
  { key: "data_evento", description: "Data do evento ou da gravação (da proposta ou do projeto)." },
  { key: "local_evento", description: "Local do evento ou da gravação (da proposta ou do projeto)." },
  { key: "projeto", description: "Nome do projeto vinculado." },
  { key: "data_hoje", description: "Data em que o contrato é criado, ex.: 18/11/2026." },
  { key: "data_hoje_extenso", description: "A mesma data por extenso, ex.: 18 de novembro de 2026." },
] as const;

export type ContractFieldKey = (typeof CONTRACT_FIELDS)[number]["key"];
export type ContractFieldValues = Partial<Record<ContractFieldKey, string>>;

const KNOWN_KEYS: ReadonlySet<string> = new Set(CONTRACT_FIELDS.map((field) => field.key));

/** `{{ campo }}` — sem chaves nem quebras de linha dentro. */
const FIELD_PATTERN = /\{\{\s*([^{}\n]{1,60}?)\s*\}\}/g;

/** "Data Evento", "data-evento" e "serviço" valem como `data_evento` e `servico`. */
function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Troca os campos `{{…}}` do texto pelos valores. Campo desconhecido ou sem valor (ausente, vazio) fica exatamente
 * como foi escrito. A troca é feita numa passada só: um valor que contenha `{{…}}` não é expandido de novo.
 */
export function fillContractFields(text: string, values: ContractFieldValues): string {
  return text.replace(FIELD_PATTERN, (match, raw: string) => {
    const key = normalizeKey(raw);
    if (!KNOWN_KEYS.has(key)) return match;
    const value = values[key as ContractFieldKey];
    return value && value.trim() ? value : match;
  });
}

export type UnfilledField = {
  /** Como aparece no texto, ex.: `{{documento}}`. */
  token: string;
  /** É um campo automático (faltou o dado) ou um nome que o sistema não conhece? */
  known: boolean;
};

/** Campos `{{…}}` que ainda estão no texto, sem repetição, na ordem em que aparecem. */
export function findUnfilledFields(text: string): UnfilledField[] {
  const found = new Map<string, UnfilledField>();
  for (const match of text.matchAll(FIELD_PATTERN)) {
    const key = normalizeKey(match[1]);
    const known = KNOWN_KEYS.has(key);
    const token = known ? `{{${key}}}` : match[0];
    if (!found.has(token)) found.set(token, { token, known });
  }
  return [...found.values()];
}

/** CPF `000.000.000-00` / CNPJ `00.000.000/0000-00`; qualquer outra coisa volta como veio (mesma regra da ficha do cliente). */
function formatCpfCnpj(value: string): string {
  const d = onlyDigits(value);
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return value.trim();
}

/** De onde vêm os dados. A proposta entra SÓ pela visão pública (a do PDF). */
export type ContractFieldSource = {
  client: { name: string; contactName: string; document: string; email: string; whatsapp: string; city: string } | null;
  proposal: Pick<PublicProposal, "number" | "version" | "title" | "contactName" | "eventDate" | "eventLocation" | "totalCents" | "entry" | "balanceCents" | "payments"> | null;
  project: { title: string; eventDate: ISODate | null; location: string } | null;
  /** Data de criação do contrato (fuso do estúdio). */
  today: ISODate;
};

/** Monta os valores dos campos já formatados (R$, datas, telefone, CPF/CNPJ). O que não existir fica de fora. */
export function buildContractFieldValues({ client, proposal, project, today }: ContractFieldSource): ContractFieldValues {
  const hasPrice = proposal !== null && proposal.totalCents > 0;
  const values: Record<ContractFieldKey, string> = {
    cliente: client?.name ?? "",
    contato: client?.contactName || proposal?.contactName || "",
    documento: client ? formatCpfCnpj(client.document) : "",
    email: client?.email ?? "",
    whatsapp: formatPhone(client?.whatsapp),
    cidade: client?.city ?? "",
    servico: proposal?.title || project?.title || "",
    proposta: proposal ? `${proposal.number}${proposal.version > 1 ? ` v${proposal.version}` : ""}` : "",
    valor_total: hasPrice ? formatBRL(proposal.totalCents) : "",
    entrada: hasPrice && proposal.entry ? formatBRL(proposal.entry.cents) : "",
    saldo: hasPrice ? formatBRL(proposal.balanceCents) : "",
    parcelas: (proposal?.payments ?? []).map((payment) => `- ${payment.label}: ${formatBRL(payment.amountCents)}${payment.dueText ? ` — ${payment.dueText}` : ""}`).join("\n"),
    data_evento: formatDate(proposal?.eventDate ?? project?.eventDate),
    local_evento: proposal?.eventLocation || project?.location || "",
    projeto: project?.title ?? "",
    data_hoje: formatDate(today),
    data_hoje_extenso: formatDateLong(today),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== ""));
}

/** Frase curta para os avisos de tela: "Falta preencher 1 campo: {{documento}}." */
export function unfilledFieldsSummary(fields: UnfilledField[]): string {
  if (fields.length === 0) return "";
  const list = fields.map((field) => field.token).join(", ");
  return fields.length === 1 ? `Falta preencher 1 campo: ${list}.` : `Falta preencher ${fields.length} campos: ${list}.`;
}
