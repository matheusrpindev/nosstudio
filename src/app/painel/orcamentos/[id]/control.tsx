"use client";

/** Etapa "PDF e controle": pré-visualização, status, projeto, financeiro, contrato, versões e demais ações. */
import { Check, Copy, Download, ExternalLink, FilePlus2, FolderKanban, LayoutTemplate, Link2, ListChecks, Send, Trash2, Undo2, Wallet, X } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { ActionForm, Field, FormActions, SubmitButton } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { DateText } from "@/components/ui/text";
import { formatDate } from "@/lib/dates";
import { CONTRACT_STATUS_LABELS, PROPOSAL_STATUS_LABELS, type ContractStatus, type FinanceType, type ProposalStatus } from "@/lib/domain";
import { formatBRL } from "@/lib/format";
import {
  convertToProjectAction,
  createVersionAction,
  deleteProposalAction,
  duplicateProposalAction,
  linkContractAction,
  saveAsTemplateAction,
  setProposalStatusAction,
} from "../actions";
import { PROPOSAL_STATUS_TONES, proposalNumberLabel } from "../ui";

export type ControlData = {
  id: number;
  isTemplate: boolean;
  number: string;
  version: number;
  status: ProposalStatus;
  clientId: number | null;
  sentAt: string | null;
  respondedAt: string | null;
  versions: { id: number; version: number; status: ProposalStatus; createdAt: string; sentAt: string | null }[];
  project: { id: number; title: string } | null;
  contractId: number | null;
  contracts: { id: number; title: string; status: ContractStatus }[];
  /** Lançamentos do financeiro já ligados a esta proposta (`count` 0 = parcelas ainda não geradas). */
  finance: {
    count: number;
    receivableCents: number;
    receivedCents: number;
    entries: { id: number; type: FinanceType; description: string; amountCents: number; dueDate: string; paidAt: string | null }[];
  };
  /** Hoje (`YYYY-MM-DD`, fuso do estúdio): para marcar lançamentos vencidos. */
  today: string;
  defaultTemplateName: string;
};

type Props = ControlData & {
  /** Há alterações ainda não salvas: o PDF e as ações valem para a última versão SALVA. */
  dirty: boolean;
  /** Muda a cada salvamento (recarrega o iframe do PDF). */
  pdfKey: number;
};

const pdfUrl = (id: number) => `/painel/orcamentos/${id}/pdf`;

/** Lista do financeiro só com os lançamentos desta proposta (`?proposta=`; o filtro atravessa os meses). */
const financeListUrl = (id: number) => `/painel/financeiro?proposta=${id}#lancamentos`;

/** "Recebido em 05/12/2026" · "Vencido em …" · "Vence em …" (despesas: "Pago em …"). */
function entrySituation(entry: { type: FinanceType; dueDate: string; paidAt: string | null }, today: string): { text: string; tone: string } {
  if (entry.paidAt) return { text: `${entry.type === "receita" ? "Recebido" : "Pago"} em ${formatDate(entry.paidAt)}`, tone: "text-sucesso" };
  if (entry.dueDate < today) return { text: `Vencido em ${formatDate(entry.dueDate)}`, tone: "text-perigo" };
  return { text: `Vence em ${formatDate(entry.dueDate)}`, tone: "text-cinza" };
}

function StatusButton({ id, status, children, title, description, confirmLabel, icon, variant = "secondary", disabled, tone = "primary" }: {
  id: number;
  status: ProposalStatus;
  children: string;
  title: string;
  description: string;
  confirmLabel: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "danger-ghost" | "ghost";
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant={variant} icon={icon} disabled={disabled}>
          {children}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={tone}
      action={setProposalStatusAction}
      hidden={{ id, status }}
    />
  );
}

// -------------------------------------------------------------------- modelo
function TemplateControl({ id, defaultTemplateName }: Pick<Props, "id" | "defaultTemplateName">) {
  return (
    <div className="space-y-4">
      <Card as="section" aria-labelledby="etapa-modelo-acoes">
        <CardHeader id="etapa-modelo-acoes" title="Usar este modelo" description="Modelos não têm PDF nem status: eles só servem de ponto de partida para novos orçamentos." />
        <div className="flex flex-wrap gap-2 max-sm:[&>*]:w-full">
          <ButtonLink href={`/painel/orcamentos/novo?modelo=${id}`} icon={<FilePlus2 />}>
            Criar orçamento com este modelo
          </ButtonLink>
          <ConfirmDialog
            trigger={
              <Button variant="secondary" icon={<Copy />}>
                Duplicar modelo
              </Button>
            }
            title="Duplicar este modelo?"
            description={
              <>
                Vamos criar uma cópia de <strong className="text-grafite">{defaultTemplateName}</strong> e abrir o editor dela.
              </>
            }
            confirmLabel="Duplicar"
            tone="primary"
            action={duplicateProposalAction}
            hidden={{ id }}
          />
          <ConfirmDialog
            trigger={
              <Button variant="danger-ghost" icon={<Trash2 />}>
                Excluir modelo
              </Button>
            }
            title="Excluir este modelo?"
            description="O modelo será apagado. As propostas já criadas a partir dele não mudam."
            confirmLabel="Excluir modelo"
            action={deleteProposalAction}
            hidden={{ id }}
          />
        </div>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ proposta
export function ControlStep(props: Props) {
  const { id, isTemplate, number, version, status, clientId, sentAt, respondedAt, versions, project, contractId, contracts, finance, today, defaultTemplateName, dirty, pdfKey } = props;
  if (isTemplate) return <TemplateControl id={id} defaultTemplateName={defaultTemplateName} />;

  const label = proposalNumberLabel(number, version);
  const blocked = dirty;

  return (
    <div className="space-y-4">
      {dirty ? (
        <Alert tone="alerta" role="status" title="Há alterações não salvas">
          O PDF e as ações desta etapa valem para a última versão <strong>salva</strong>. Salve primeiro (botão na barra de baixo).
        </Alert>
      ) : null}

      <Card as="section" aria-labelledby="etapa-pdf-previa">
        <CardHeader
          id="etapa-pdf-previa"
          title="PDF para o cliente"
          description="A pré-visualização é o mesmo arquivo do download. Ela só mostra o que o cliente pode ver."
          action={
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`${pdfUrl(id)}?baixar=1`} download icon={<Download />} variant="primary">
                Baixar PDF
              </ButtonLink>
              <ButtonLink href={pdfUrl(id)} external variant="secondary" icon={<ExternalLink />}>
                Abrir em nova aba
              </ButtonLink>
            </div>
          }
        />
        <iframe
          key={pdfKey}
          title={`Pré-visualização do PDF da proposta ${label}`}
          src={`${pdfUrl(id)}?v=${pdfKey}#toolbar=0&navpanes=0`}
          className="border-areia bg-offwhite rounded-campo h-[70vh] min-h-96 w-full border"
        />
        <p className="text-cinza mt-2 text-xs">Se a pré-visualização não aparecer neste aparelho (comum no celular), use “Baixar PDF” ou “Abrir em nova aba”.</p>
      </Card>

      <Card as="section" aria-labelledby="etapa-pdf-status">
        <CardHeader
          id="etapa-pdf-status"
          title="Andamento da proposta"
          action={<StatusBadge value={status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONES} />}
          description={
            <>
              {sentAt ? (
                <>
                  Enviada em <DateText value={new Date(sentAt)} format="datetime" />.{" "}
                </>
              ) : (
                "Ainda não foi enviada. "
              )}
              {respondedAt ? (
                <>
                  Resposta em <DateText value={new Date(respondedAt)} format="datetime" />.
                </>
              ) : null}
            </>
          }
        />

        <div className="flex flex-wrap gap-2 max-sm:[&>*]:w-full">
          {status === "rascunho" || status === "recusada" || status === "expirada" ? (
            <StatusButton
              id={id}
              status="enviada"
              variant="primary"
              icon={<Send />}
              disabled={blocked || !clientId}
              title="Marcar como enviada?"
              description="Registra a data de envio e anota no histórico do cliente. Se ele ainda estiver como “Novo contato”, passa para “Em orçamento” no funil. O PDF não é enviado por aqui: baixe e mande por WhatsApp ou e-mail."
              confirmLabel="Marcar como enviada"
            >
              {status === "rascunho" ? "Marcar como enviada" : "Marcar como enviada de novo"}
            </StatusButton>
          ) : null}

          {status === "enviada" ? (
            <>
              <StatusButton
                id={id}
                status="aceita"
                variant="primary"
                icon={<Check />}
                disabled={blocked}
                title="Cliente aceitou a proposta?"
                description="Registra a resposta, anota no histórico e move o cliente para “Fechado” no funil. Depois você pode gerar as parcelas no financeiro e converter a proposta em projeto."
                confirmLabel="Marcar como aceita"
              >
                Aceita
              </StatusButton>
              <StatusButton
                id={id}
                status="recusada"
                icon={<X />}
                disabled={blocked}
                title="Cliente recusou a proposta?"
                description="Registra a resposta e anota no histórico do cliente."
                confirmLabel="Marcar como recusada"
              >
                Recusada
              </StatusButton>
              <StatusButton
                id={id}
                status="expirada"
                icon={<Undo2 />}
                disabled={blocked}
                title="Marcar como expirada?"
                description="Use quando a validade passou sem resposta. Você ainda pode reenviar depois."
                confirmLabel="Marcar como expirada"
              >
                Expirada
              </StatusButton>
            </>
          ) : null}

          {status === "aceita" ? (
            project ? (
              <ButtonLink href={`/painel/projetos/${project.id}`} icon={<FolderKanban />}>
                Abrir o projeto
              </ButtonLink>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button icon={<FolderKanban />} disabled={blocked}>
                    Converter em projeto
                  </Button>
                }
                title="Converter em projeto?"
                description="Cria o projeto com o cliente, o título, o tipo de serviço, a data e o local desta proposta, e abre a tela dele. O cliente passa para “Em produção” no funil."
                confirmLabel="Converter em projeto"
                tone="primary"
                action={convertToProjectAction}
                hidden={{ id }}
              />
            )
          ) : null}

          {status !== "rascunho" ? (
            <StatusButton
              id={id}
              status="rascunho"
              variant="ghost"
              icon={<Undo2 />}
              disabled={blocked}
              title="Voltar para rascunho?"
              description="A proposta volta a ser rascunho (a data de envio anterior fica registrada no histórico do cliente). O cliente continua na etapa em que está no funil."
              confirmLabel="Voltar para rascunho"
            >
              Voltar para rascunho
            </StatusButton>
          ) : null}
        </div>
        {!clientId && status === "rascunho" ? <p className="text-alerta mt-3 text-sm font-semibold">Escolha o cliente na etapa Dados e salve para poder marcar como enviada.</p> : null}
        {status !== "rascunho" ? (
          <p className="text-cinza mt-3 text-sm">Para mudar valores de uma proposta já enviada sem perder o que o cliente recebeu, crie uma nova versão (abaixo).</p>
        ) : null}
      </Card>

      {status === "aceita" ? (
        <Card as="section" aria-labelledby="etapa-pdf-financeiro">
          <CardHeader
            id="etapa-pdf-financeiro"
            title="Financeiro"
            description={
              finance.count === 0
                ? "Proposta aceita: transforme as parcelas (etapa Preço ao cliente) em contas a receber. Você confere tudo antes de criar."
                : "Os lançamentos desta proposta já estão no financeiro. Toque em um deles para abrir, dar baixa ou corrigir."
            }
          />
          {finance.count === 0 ? (
            <div className="flex flex-wrap gap-2 max-sm:[&>*]:w-full">
              <ButtonLink href={`/painel/financeiro/novo/parcelas?proposta=${id}`} icon={<ListChecks />}>
                Gerar parcelas no financeiro
              </ButtonLink>
            </div>
          ) : (
            <>
              <p className="text-grafite mb-3 text-sm">
                <strong className="tabular-nums">{finance.count}</strong> {finance.count === 1 ? "lançamento" : "lançamentos"}
                {finance.receivableCents > 0 ? (
                  <>
                    {" "}
                    · <span className="tabular-nums">{formatBRL(finance.receivableCents)}</span> a receber no total · <span className="tabular-nums">{formatBRL(finance.receivedCents)}</span> já recebido
                  </>
                ) : null}
              </p>
              <ul className="divide-areia border-areia rounded-campo mb-3 divide-y border">
                {finance.entries.map((entry) => {
                  const situation = entrySituation(entry, today);
                  return (
                    <li key={entry.id}>
                      <Link href={`/painel/financeiro/${entry.id}`} className="hover:bg-offwhite flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2.5 text-sm">
                        <span className="text-grafite min-w-0 flex-1 basis-48 font-semibold break-words">{entry.description}</span>
                        <span className={`${situation.tone} text-[0.8125rem]`}>{situation.text}</span>
                        <span className="text-grafite font-bold tabular-nums">
                          {entry.type === "despesa" ? "− " : ""}
                          {formatBRL(entry.amountCents)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {finance.count > finance.entries.length ? <p className="text-cinza mb-3 text-sm">Mostrando os {finance.entries.length} primeiros por vencimento.</p> : null}
              <div className="flex flex-wrap gap-2 max-sm:[&>*]:w-full">
                <ButtonLink href={financeListUrl(id)} icon={<Wallet />}>
                  Ver lançamentos desta proposta
                </ButtonLink>
                <ButtonLink href={`/painel/financeiro/novo?proposta=${id}`} variant="ghost" icon={<FilePlus2 />}>
                  Novo lançamento desta proposta
                </ButtonLink>
              </div>
            </>
          )}
          {finance.count > 0 ? null : dirty ? (
            <p className="text-cinza mt-3 text-sm">As parcelas vêm da última versão salva da proposta.</p>
          ) : null}
        </Card>
      ) : null}

      <Card as="section" aria-labelledby="etapa-pdf-contrato">
        <CardHeader id="etapa-pdf-contrato" title="Contrato" description="Vincule o contrato do cliente a esta proposta para achar tudo num lugar só." />
        {!clientId ? (
          <p className="text-cinza text-sm">Escolha o cliente na etapa Dados para vincular um contrato.</p>
        ) : (
          <div className="space-y-4">
            {contracts.length > 0 ? (
              <ActionForm action={linkContractAction} hidden={{ id }} className="space-y-3">
                <Field name="contractId" label="Contrato do cliente" optional>
                  <Select
                    placeholder="Nenhum contrato vinculado"
                    defaultValue={contractId ?? ""}
                    options={contracts.map((contract) => ({ value: contract.id, label: `${contract.title} (${CONTRACT_STATUS_LABELS[contract.status]})` }))}
                  />
                </Field>
                <FormActions>
                  <SubmitButton variant="secondary" icon={<Link2 />} pendingLabel="Vinculando…" disabled={blocked}>
                    Salvar vínculo
                  </SubmitButton>
                </FormActions>
              </ActionForm>
            ) : (
              <p className="text-cinza text-sm">Este cliente ainda não tem contratos.</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {contractId ? (
                <Link href={`/painel/contratos/${contractId}`} className="link text-sm font-semibold">
                  Abrir o contrato vinculado
                </Link>
              ) : null}
              <ButtonLink href={`/painel/contratos/novo?cliente=${clientId}&proposta=${id}`} variant="ghost" icon={<FilePlus2 />}>
                Criar contrato desta proposta
              </ButtonLink>
            </div>
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="etapa-pdf-versoes">
        <CardHeader
          id="etapa-pdf-versoes"
          title="Versões"
          description="Cada versão guarda exatamente o que foi montado naquele momento. O número da proposta é o mesmo em todas."
        />
        <ol className="divide-areia divide-y">
          {versions.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1 text-sm">
                {item.id === id ? (
                  <span className="text-grafite font-bold">
                    Versão {item.version} <span className="text-cinza font-normal">(esta)</span>
                  </span>
                ) : (
                  <Link href={`/painel/orcamentos/${item.id}`} className="link font-semibold">
                    Versão {item.version}
                  </Link>
                )}
                <span className="text-cinza block text-[0.8125rem]">
                  criada em <DateText value={new Date(item.createdAt)} format="datetime" />
                  {item.sentAt ? (
                    <>
                      {" "}
                      · enviada em <DateText value={new Date(item.sentAt)} />
                    </>
                  ) : null}
                </span>
              </span>
              <StatusBadge value={item.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_STATUS_TONES} />
            </li>
          ))}
        </ol>
        <div className="mt-3">
          <ConfirmDialog
            trigger={
              <Button variant="secondary" icon={<FilePlus2 />} disabled={blocked}>
                Criar nova versão
              </Button>
            }
            title="Criar uma nova versão?"
            description={`Copia tudo desta versão para um novo rascunho (versão ${Math.max(version, ...versions.map((item) => item.version)) + 1}) com o mesmo número ${number}. Esta versão continua como está.`}
            confirmLabel="Criar nova versão"
            tone="primary"
            action={createVersionAction}
            hidden={{ id }}
          />
        </div>
      </Card>

      <Card as="section" aria-labelledby="etapa-pdf-outras">
        <CardHeader id="etapa-pdf-outras" title="Outras ações" />
        <div className="flex flex-wrap gap-2 max-sm:[&>*]:w-full">
          <ConfirmDialog
            trigger={
              <Button variant="secondary" icon={<Copy />} disabled={blocked}>
                Duplicar
              </Button>
            }
            title="Duplicar esta proposta?"
            description="Cria uma proposta nova (outro número, versão 1, rascunho) com o mesmo conteúdo — útil para outro cliente parecido."
            confirmLabel="Duplicar"
            tone="primary"
            action={duplicateProposalAction}
            hidden={{ id }}
          />
          <Dialog
            trigger={
              <Button variant="secondary" icon={<LayoutTemplate />} disabled={blocked}>
                Salvar como modelo
              </Button>
            }
            title="Salvar como modelo"
            description="Guarda itens, parcelas, textos e custos como ponto de partida. Cliente, datas, validade e notas internas não vão para o modelo."
          >
            <ActionForm action={saveAsTemplateAction} hidden={{ id }}>
              <Field name="templateName" label="Nome do modelo" hint="Só aparece no painel." required>
                <Input maxLength={120} autoComplete="off" defaultValue={defaultTemplateName} />
              </Field>
              <FormActions>
                <SubmitButton pendingLabel="Salvando…">Salvar modelo</SubmitButton>
              </FormActions>
            </ActionForm>
          </Dialog>
          {status === "rascunho" ? (
            <ConfirmDialog
              trigger={
                <Button variant="danger-ghost" icon={<Trash2 />}>
                  Excluir rascunho
                </Button>
              }
              title="Excluir este rascunho?"
              description="A proposta e tudo que foi montado nela serão apagados e não dá para desfazer."
              confirmLabel="Excluir rascunho"
              action={deleteProposalAction}
              hidden={{ id }}
            />
          ) : null}
        </div>
        {status !== "rascunho" ? <p className="text-cinza mt-3 text-sm">Só rascunhos podem ser excluídos: propostas enviadas ficam como histórico.</p> : null}
      </Card>
    </div>
  );
}
