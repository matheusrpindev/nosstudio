/**
 * Exportação dos dados da NÓS: contagem por tabela, JSON completo e CSVs.
 * NUNCA inclui `password_hash`, sessões, tokens de redefinição de senha nem o limitador de tentativas.
 */
import "server-only";
import { count, eq, getTableColumns, getTableName, is } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db, schema } from "@/db";
import { clients, financeEntries, leads, projects } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  CLIENT_KIND_LABELS,
  CLIENT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  FINANCE_CATEGORY_LABELS,
  FINANCE_TYPE_LABELS,
  LEAD_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SERVICE_INTEREST_LABELS,
} from "@/lib/domain";
import { centsToCsv, EXPORT_EXCLUDED_COLUMNS, EXPORT_EXCLUDED_TABLES, stripSecretColumns, toCsv } from "./logic";

type ExportTable = { name: string; table: SQLiteTable };

/** Todas as tabelas do schema, menos as proibidas. Tabelas novas entram sozinhas na exportação. */
function exportTables(): ExportTable[] {
  const found: ExportTable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, SQLiteTable)) continue;
    const name = getTableName(value);
    if (!EXPORT_EXCLUDED_TABLES.has(name)) found.push({ name, table: value });
  }
  return found.sort((a, b) => a.name.localeCompare(b.name));
}

/** Colunas selecionáveis de uma tabela, sem as proibidas (o hash nem sai do banco). */
function safeColumns(table: SQLiteTable) {
  return Object.fromEntries(Object.entries(getTableColumns(table)).filter(([key, column]) => !EXPORT_EXCLUDED_COLUMNS.has(key) && !EXPORT_EXCLUDED_COLUMNS.has(column.name)));
}

export async function countRecords(): Promise<{ name: string; total: number }[]> {
  return Promise.all(
    exportTables().map(async ({ name, table }) => {
      const [row] = await db.select({ total: count() }).from(table);
      return { name, total: row.total };
    }),
  );
}

/** Exportação completa: um objeto com as linhas de cada tabela. */
export async function exportAllJson(exportedAt: Date): Promise<{ json: string; counts: Record<string, number> }> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const { name, table } of exportTables()) {
    const rows = await db.select(safeColumns(table)).from(table);
    tables[name] = rows.map((row) => stripSecretColumns(row as Record<string, unknown>));
    counts[name] = rows.length;
  }
  const payload = {
    sistema: "NÓS Studio — painel de gestão",
    exportadoEm: exportedAt.toISOString(),
    observacoes: [
      "Valores em dinheiro estão em centavos. Datas de calendário são AAAA-MM-DD; instantes seguem ISO 8601 (UTC).",
      "Contém dados pessoais de clientes e leads (LGPD): guarde em local seguro.",
      "Não inclui senhas, sessões nem tokens. Os arquivos enviados (mídia) não estão aqui: use `npm run backup` para copiá-los.",
    ],
    contagem: counts,
    tabelas: tables,
  };
  return { json: JSON.stringify(payload, null, 2), counts };
}

// ------------------------------------------------------------------------ CSVs
export const CSV_KINDS = ["clientes", "leads", "financeiro"] as const;
export type CsvKind = (typeof CSV_KINDS)[number];

export async function exportCsv(kind: CsvKind): Promise<{ csv: string; count: number }> {
  if (kind === "clientes") {
    const rows = await db.select().from(clients).orderBy(clients.id);
    const csv = toCsv(
      ["ID", "Nome ou empresa", "Contato", "Tipo", "WhatsApp", "E-mail", "CPF/CNPJ", "Cidade", "Segmento", "Origem", "Interesse", "Etapa", "Primeiro contato", "Próximo passo", "Data do próximo passo", "Observações internas", "Cadastrado em"],
      rows.map((c) => [c.id, c.name, c.contactName, CLIENT_KIND_LABELS[c.kind], c.whatsapp, c.email, c.document, c.city, c.segment, CONTACT_SOURCE_LABELS[c.source], SERVICE_INTEREST_LABELS[c.serviceInterest], CLIENT_STATUS_LABELS[c.status], formatDate(c.firstContactAt), c.nextStep, formatDate(c.nextStepDate), c.notes, formatDateTime(c.createdAt)]),
    );
    return { csv, count: rows.length };
  }
  if (kind === "leads") {
    const rows = await db.select().from(leads).orderBy(leads.id);
    const csv = toCsv(
      ["ID", "Nome", "WhatsApp", "E-mail", "Interesse", "Data do evento", "Cidade", "Mensagem", "Origem", "Status", "Consentimento (LGPD) em", "Versão da política", "Recebido em"],
      rows.map((l) => [l.id, l.name, l.whatsapp, l.email, SERVICE_INTEREST_LABELS[l.serviceInterest], formatDate(l.eventDate), l.city, l.message, CONTACT_SOURCE_LABELS[l.source], LEAD_STATUS_LABELS[l.status], formatDateTime(l.consentAt), l.consentVersion, formatDateTime(l.createdAt)]),
    );
    return { csv, count: rows.length };
  }
  const rows = await db
    .select({ entry: financeEntries, clientName: clients.name, projectName: projects.title })
    .from(financeEntries)
    .leftJoin(clients, eq(financeEntries.clientId, clients.id))
    .leftJoin(projects, eq(financeEntries.projectId, projects.id))
    .orderBy(financeEntries.dueDate, financeEntries.id);
  const csv = toCsv(
    ["ID", "Tipo", "Categoria", "Descrição", "Valor (R$)", "Vencimento", "Pago/recebido em", "Parcela", "Forma de pagamento", "Fornecedor", "Cliente", "Projeto", "Observações", "Cadastrado em"],
    rows.map(({ entry: e, clientName, projectName }) => [e.id, FINANCE_TYPE_LABELS[e.type], FINANCE_CATEGORY_LABELS[e.category], e.description, centsToCsv(e.amountCents), formatDate(e.dueDate), formatDate(e.paidAt), e.installmentLabel, e.method ? PAYMENT_METHOD_LABELS[e.method] : "", e.supplier, clientName, projectName, e.notes, formatDateTime(e.createdAt)]),
  );
  return { csv, count: rows.length };
}
