/**
 * LGPD — o que o sistema guarda sobre UM titular (cliente): contagem para o diálogo de exclusão e a exportação
 * "Dados deste titular" (pedido de acesso/portabilidade). Só fala com o banco; quem autoriza (só administrador)
 * e audita é a rota `src/app/painel/clientes/[id]/dados/route.ts`.
 *
 * AGENDA: os compromissos ligados ao cliente saem pela privacidade da agenda (`@/server/agenda-related`), para
 * quem está exportando ou olhando (`viewer`). Compromisso PARTICULAR de outra pessoa não entra — nem na contagem
 * do diálogo de exclusão, nem com conteúdo na exportação. Na exportação, quem responde ao pedido do titular
 * precisa saber que falta algo: o arquivo diz QUANTOS ficaram de fora e DE QUEM são (sem data, horário nem
 * conteúdo), para pedir a essa pessoa que complete a resposta. É a única informação que sai, é só para quem tem
 * "baixar" em Exportação de dados, e o download fica na auditoria com esse número.
 */
import "server-only";
import { and, asc, count, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clientInteractions, clients, contentItems, contracts, financeEntries, leads, projects, proposals, tasks } from "@/db/schema";
import { ruleOf } from "@/lib/agenda/expand";
import { describeRecurrence } from "@/lib/agenda/recurrence";
import { listClientEventRecords, type AgendaViewer } from "@/server/agenda-related";

type ContactKeys = { id: number; whatsapp: string; email: string };

/**
 * Pedidos recebidos pelo site (leads) que são desta pessoa: os ligados ao cadastro (lead convertido) e os que
 * têm o mesmo WhatsApp ou o mesmo e-mail (um segundo pedido que ninguém vinculou). É a mesma regra na
 * contagem, na exportação e na exclusão — o que a tela promete apagar é exatamente o que é apagado.
 */
export function subjectLeadsWhere(client: ContactKeys): SQL {
  const conditions: SQL[] = [eq(leads.clientId, client.id)];
  const whatsapp = client.whatsapp.replace(/\D/g, "");
  if (whatsapp.length >= 10) conditions.push(eq(leads.whatsapp, whatsapp));
  const email = client.email.trim().toLowerCase();
  if (email) conditions.push(sql`lower(${leads.email}) = ${email}`);
  return or(...conditions) as SQL;
}

export type ClientFootprint = {
  /** Apagados junto com o cliente (cascata). */
  interactions: number;
  contentItems: number;
  /** Pedidos do site desta pessoa (apagados só se a opção for marcada). */
  leads: number;
  /** Continuam existindo, sem cliente vinculado. */
  proposals: number;
  projects: number;
  contracts: number;
  financeEntries: number;
  /** Só os compromissos que QUEM ESTÁ OLHANDO vê por inteiro (particulares de terceiros não contam). */
  events: number;
  tasks: number;
};

/**
 * Quantos registros de cada módulo citam este cliente. `null` se o cliente não existe.
 * `viewer` é quem vai ver a contagem: um compromisso particular de outra pessoa não entra nela (a contagem não
 * pode revelar que ele existe). Ao excluir o cliente, esse compromisso também só perde o vínculo.
 */
export async function getClientFootprint(clientId: number, viewer: AgendaViewer): Promise<ClientFootprint | null> {
  const [client] = await db.select({ id: clients.id, whatsapp: clients.whatsapp, email: clients.email }).from(clients).where(eq(clients.id, clientId));
  if (!client) return null;
  const total = async (query: Promise<{ total: number }[]>) => (await query)[0]?.total ?? 0;
  const [interactions, content, leadCount, proposalCount, projectCount, contractCount, financeCount, eventCount, taskCount] = await Promise.all([
    total(db.select({ total: count() }).from(clientInteractions).where(eq(clientInteractions.clientId, clientId))),
    total(db.select({ total: count() }).from(contentItems).where(eq(contentItems.clientId, clientId))),
    total(db.select({ total: count() }).from(leads).where(subjectLeadsWhere(client))),
    total(db.select({ total: count() }).from(proposals).where(and(eq(proposals.clientId, clientId), eq(proposals.isTemplate, false)))),
    total(db.select({ total: count() }).from(projects).where(eq(projects.clientId, clientId))),
    total(db.select({ total: count() }).from(contracts).where(and(eq(contracts.clientId, clientId), eq(contracts.isTemplate, false)))),
    total(db.select({ total: count() }).from(financeEntries).where(eq(financeEntries.clientId, clientId))),
    listClientEventRecords(viewer, clientId).then((events) => events.visible.length),
    total(db.select({ total: count() }).from(tasks).where(eq(tasks.clientId, clientId))),
  ]);
  return {
    interactions,
    contentItems: content,
    leads: leadCount,
    proposals: proposalCount,
    projects: projectCount,
    contracts: contractCount,
    financeEntries: financeCount,
    events: eventCount,
    tasks: taskCount,
  };
}

/** "2 orçamentos, 1 projeto e 3 lançamentos financeiros" — só o que existe. Vazio se nada continua. */
export function describeRemaining(footprint: ClientFootprint): string {
  const parts = (
    [
      [footprint.proposals, "orçamento", "orçamentos"],
      [footprint.projects, "projeto", "projetos"],
      [footprint.contracts, "contrato", "contratos"],
      [footprint.financeEntries, "lançamento financeiro", "lançamentos financeiros"],
      [footprint.events, "compromisso na agenda", "compromissos na agenda"],
      [footprint.tasks, "tarefa", "tarefas"],
    ] as const
  )
    .filter(([total]) => total > 0)
    .map(([total, one, many]) => `${total} ${total === 1 ? one : many}`);
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

/**
 * Exportação "Dados deste titular": tudo o que o painel guarda ligado ao cadastro, num JSON legível.
 * Não inclui o cálculo interno dos orçamentos (custos, margem, notas internas, descontos) nem as despesas da
 * NÓS ligadas ao cliente — isso não é dado do titular. Arquivos enviados (contrato assinado, comprovantes) não
 * vão no JSON: o arquivo indica onde eles existem.
 */
export async function exportClientSubjectData(
  clientId: number,
  exportedAt: Date,
  viewer: AgendaViewer,
): Promise<{ json: string; total: number; withheldEvents: number } | null> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!client) return null;

  const [interactionRows, leadRows, proposalRows, projectRows, contractRows, incomeRows, expenseCount, events, taskRows, contentRows] = await Promise.all([
    db
      .select({ tipo: clientInteractions.kind, texto: clientInteractions.content, quando: clientInteractions.occurredAt })
      .from(clientInteractions)
      .where(eq(clientInteractions.clientId, clientId))
      .orderBy(asc(clientInteractions.occurredAt)),
    db.select().from(leads).where(subjectLeadsWhere(client)).orderBy(asc(leads.createdAt)),
    db
      .select({
        id: proposals.id,
        numero: proposals.number,
        versao: proposals.version,
        situacao: proposals.status,
        titulo: proposals.title,
        nomeNaCapa: proposals.clientDisplayName,
        contato: proposals.contactName,
        dataDoEvento: proposals.eventDate,
        localDoEvento: proposals.eventLocation,
        validoAte: proposals.validUntil,
        enviadoEm: proposals.sentAt,
        respondidoEm: proposals.respondedAt,
        criadoEm: proposals.createdAt,
      })
      .from(proposals)
      .where(and(eq(proposals.clientId, clientId), eq(proposals.isTemplate, false)))
      .orderBy(asc(proposals.id)),
    db
      .select({
        id: projects.id,
        titulo: projects.title,
        servico: projects.serviceType,
        etapa: projects.stage,
        local: projects.location,
        dataDoEvento: projects.eventDate,
        prazoDeEntrega: projects.deliveryDeadline,
        entregueEm: projects.deliveredAt,
        linkDaGaleria: projects.galleryUrl,
        linkDosArquivosFinais: projects.finalFilesUrl,
        observacoes: projects.notes,
        criadoEm: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.clientId, clientId))
      .orderBy(asc(projects.id)),
    db
      .select({
        id: contracts.id,
        titulo: contracts.title,
        tipo: contracts.kind,
        situacao: contracts.status,
        assinadoEm: contracts.signedAt,
        vigenciaInicio: contracts.validFrom,
        vigenciaFim: contracts.validUntil,
        texto: contracts.body,
        linkExterno: contracts.externalUrl,
        arquivoAssinado: contracts.fileMediaId,
        observacoes: contracts.notes,
        criadoEm: contracts.createdAt,
      })
      .from(contracts)
      .where(and(eq(contracts.clientId, clientId), eq(contracts.isTemplate, false)))
      .orderBy(asc(contracts.id)),
    db
      .select({
        id: financeEntries.id,
        descricao: financeEntries.description,
        valorCentavos: financeEntries.amountCents,
        vencimento: financeEntries.dueDate,
        recebidoEm: financeEntries.paidAt,
        parcela: financeEntries.installmentLabel,
        formaDePagamento: financeEntries.method,
        comprovante: financeEntries.receiptMediaId,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.clientId, clientId), eq(financeEntries.type, "receita")))
      .orderBy(asc(financeEntries.dueDate), asc(financeEntries.id)),
    db
      .select({ total: count() })
      .from(financeEntries)
      .where(and(eq(financeEntries.clientId, clientId), eq(financeEntries.type, "despesa"))),
    listClientEventRecords(viewer, clientId),
    db
      .select({ id: tasks.id, titulo: tasks.title, descricao: tasks.description, prazo: tasks.dueDate, concluida: tasks.done })
      .from(tasks)
      .where(eq(tasks.clientId, clientId))
      .orderBy(asc(tasks.id)),
    db
      .select({ id: contentItems.id, tema: contentItems.title, rede: contentItems.network, formato: contentItems.format, situacao: contentItems.status, gravacao: contentItems.recordDate, publicacao: contentItems.publishDate, legenda: contentItems.caption })
      .from(contentItems)
      .where(eq(contentItems.clientId, clientId))
      .orderBy(asc(contentItems.id)),
  ]);

  const hasFile = (id: number | null) => (id ? "sim — arquivo guardado no painel" : "não");
  // Só o que QUEM EXPORTA vê por inteiro; os particulares de outras pessoas ficam de fora (ver o topo do arquivo).
  const eventRows = events.visible.map((event) => ({
    id: event.id,
    titulo: event.title,
    categoria: event.categoryName,
    situacao: event.status,
    particular: event.visibility === "particular",
    data: event.date,
    ultimoDia: event.endDate,
    inicio: event.startTime,
    fim: event.endTime,
    repeticao: ruleOf(event) ? describeRecurrence(event.date, ruleOf(event)) : null,
    local: event.location,
    descricao: event.description,
    observacoes: event.notes,
    anexos: event.attachments.length,
  }));
  // mascarados (particulares de outra pessoa) + os que a agenda não entrega a quem exporta (sem alcance)
  const withheld = events.masked.length + events.unreachable;
  const withheldOwners = [...new Set(events.masked.map((event) => event.ownerName).filter((name): name is string => Boolean(name)))];
  const sections = {
    cadastro: {
      id: client.id,
      nome: client.name,
      contato: client.contactName,
      tipo: client.kind,
      whatsapp: client.whatsapp,
      email: client.email,
      cpfOuCnpj: client.document,
      cidade: client.city,
      segmento: client.segment,
      origem: client.source,
      interesse: client.serviceInterest,
      etapa: client.status,
      motivoDaPerda: client.lostReason,
      primeiroContato: client.firstContactAt,
      proximoPasso: client.nextStep,
      dataDoProximoPasso: client.nextStepDate,
      datasImportantes: client.importantDates,
      observacoesInternas: client.notes,
      cadastradoEm: client.createdAt,
      atualizadoEm: client.updatedAt,
    },
    historicoDeAtendimento: interactionRows,
    pedidosPeloSite: leadRows.map((lead) => ({
      id: lead.id,
      vinculadoAoCadastro: lead.clientId === client.id,
      nome: lead.name,
      whatsapp: lead.whatsapp,
      email: lead.email,
      interesse: lead.serviceInterest,
      dataDoEvento: lead.eventDate,
      cidade: lead.city,
      mensagem: lead.message,
      detalhes: lead.details,
      origem: lead.source,
      paginaDeOrigem: lead.originPath,
      consentimentoEm: lead.consentAt,
      versaoDaPolitica: lead.consentVersion,
      situacao: lead.status,
      recebidoEm: lead.createdAt,
    })),
    orcamentos: proposalRows,
    projetos: projectRows,
    contratos: contractRows.map(({ arquivoAssinado, ...row }) => ({ ...row, arquivoAssinado: hasFile(arquivoAssinado) })),
    pagamentos: incomeRows.map(({ comprovante, ...row }) => ({ ...row, comprovante: hasFile(comprovante) })),
    agenda: eventRows,
    tarefas: taskRows,
    conteudos: contentRows,
  };
  const counts = Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, Array.isArray(value) ? value.length : 1]));
  const payload = {
    sistema: "NÓS Studio — painel de gestão",
    documento: "Dados deste titular (LGPD — acesso e portabilidade)",
    geradoEm: exportedAt.toISOString(),
    observacoes: [
      "Reúne o que o painel guarda ligado a este cadastro. Valores em centavos; datas de calendário em AAAA-MM-DD; instantes em ISO 8601 (UTC).",
      "Antes de entregar ao titular, revise: há anotações internas da equipe (observações, histórico de atendimento).",
      "Não inclui o cálculo interno dos orçamentos nem despesas da NÓS ligadas ao cliente" + (expenseCount[0]?.total ? ` (${expenseCount[0].total} lançamento(s) de despesa).` : "."),
      "Arquivos enviados (contrato assinado, comprovantes) não estão neste arquivo; onde existem, está indicado.",
      "Registros de auditoria e cópias de segurança (backups) não entram aqui.",
      ...(withheld > 0
        ? [
            `ATENÇÃO — resposta incompleta: ${withheld} compromisso(s) da agenda ligado(s) a este titular não foi(ram) incluído(s), porque quem exportou não tem acesso a ele(s)` +
              (events.masked.length ? ` (compromisso particular${withheldOwners.length ? ` de ${withheldOwners.join(", ")}` : " de outra pessoa"})` : "") +
              ". Só quem participa de um compromisso particular vê o conteúdo: peça a essa pessoa que gere esta exportação ou informe o que consta sobre o titular.",
          ]
        : []),
    ],
    contagem: counts,
    ...(withheld > 0 ? { agendaNaoIncluida: { compromissos: withheld, particularesDe: withheldOwners } } : {}),
    ...sections,
  };
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { json: JSON.stringify(payload, null, 2), total, withheldEvents: withheld };
}
