"use client";

/** Etapas do editor que viram PDF: Dados, Escopo, Preço ao cliente e Textos comerciais. */
import { CalendarClock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FieldRow } from "@/components/ui/form";
import { Checkbox, DateInput, Input, RadioCards, Select, Textarea } from "@/components/ui/input";
import { ObjectListField } from "@/components/ui/list-fields";
import { MoneyInput } from "@/components/ui/masked-inputs";
import { formatDate } from "@/lib/dates";
import { PROPOSAL_MODALITY_LABELS, type EntryMode, type ProposalItemKind, type ProposalModality } from "@/lib/domain";
import { formatBRL, formatPercent } from "@/lib/format";
import { lineTotalCents, suggestPayments } from "@/lib/proposals/calc";
import { DRAFT_LIMITS, type DraftItem, type DraftNumbers, type DraftPayment, type ProposalDraft } from "../draft";
import { DecimalInput, Mini, SumRow } from "./fields";

export type StepProps = {
  draft: ProposalDraft;
  patch: (changes: Partial<ProposalDraft>) => void;
  numbers: DraftNumbers;
  /** Erros devolvidos pelo servidor, por caminho do campo (`title`, `items.2.title`…). */
  errors: Record<string, string>;
  /** Já houve uma tentativa de salvar com erro (liga os avisos nas linhas incompletas). */
  attempted: boolean;
  /** Muda quando o rascunho é recarregado do servidor: remonta as listas editáveis. */
  listsKey: number;
};

type Option = { value: number; label: string };

const FORMAT_HINT = "Uma linha em branco separa parágrafos; linhas começando com “- ” viram tópicos; **negrito** entre asteriscos.";
const idValue = (value: string) => (value ? Number(value) : null);

// ---------------------------------------------------------------------- Dados
export function StepDados({
  draft,
  patch,
  errors,
  isTemplate,
  number,
  version,
  clients,
  users,
  today,
}: StepProps & { isTemplate: boolean; number: string; version: number; clients: Option[]; users: Option[]; today: string }) {
  const clientName = clients.find((client) => client.value === draft.clientId)?.label ?? "";
  const expired = Boolean(draft.validUntil && draft.validUntil < today);

  return (
    <Card as="section" aria-labelledby="etapa-dados">
      <CardHeader
        id="etapa-dados"
        title={isTemplate ? "Dados do modelo" : "Dados da proposta"}
        description={isTemplate ? "Modelos não têm cliente, data nem validade: isso é definido em cada proposta criada a partir dele." : "Quem recebe, o que é e até quando vale."}
      />
      <div className="space-y-5">
        {isTemplate ? (
          <Field label="Nome do modelo" hint="Só aparece no painel." error={errors.templateName} required>
            <Input value={draft.templateName} maxLength={120} onChange={(event) => patch({ templateName: event.target.value })} />
          </Field>
        ) : (
          <dl className="bg-offwhite rounded-campo grid grid-cols-2 gap-3 px-4 py-3 sm:max-w-sm">
            <div>
              <dt className="text-cinza text-xs font-semibold">Número</dt>
              <dd className="text-grafite font-bold tabular-nums">{number}</dd>
            </div>
            <div>
              <dt className="text-cinza text-xs font-semibold">Versão</dt>
              <dd className="text-grafite font-bold tabular-nums">{version}</dd>
            </div>
          </dl>
        )}

        <FieldRow>
          <Field label="Modalidade" error={errors.modality} required>
            <Select options={PROPOSAL_MODALITY_LABELS} value={draft.modality} onChange={(event) => patch({ modality: event.target.value as ProposalModality })} />
          </Field>
          <Field label="Responsável comercial" hint="Aparece no PDF como contato da proposta." error={errors.ownerId} optional>
            <Select options={users} placeholder="Sem responsável" value={draft.ownerId ?? ""} onChange={(event) => patch({ ownerId: idValue(event.target.value) })} />
          </Field>
        </FieldRow>

        <Field label="Título / serviço" hint="Aparece na capa do PDF. Ex.: Cobertura de casamento" error={errors.title} required>
          <Input value={draft.title} maxLength={160} onChange={(event) => patch({ title: event.target.value })} />
        </Field>

        {isTemplate ? null : (
          <>
            <FieldRow>
              <Field
                label="Cliente"
                error={errors.clientId}
                hint={
                  draft.clientId ? (
                    <Link href={`/painel/clientes/${draft.clientId}`} className="link">
                      Abrir cadastro do cliente
                    </Link>
                  ) : (
                    "Necessário para marcar a proposta como enviada."
                  )
                }
              >
                <Select options={clients} placeholder="Sem cliente" value={draft.clientId ?? ""} onChange={(event) => patch({ clientId: idValue(event.target.value) })} />
              </Field>
              <Field
                label="Nome na capa do PDF"
                hint={clientName ? `Ex.: “Ana & Bruno”. Em branco, usamos o nome do cadastro: ${clientName}.` : "Ex.: “Ana & Bruno”. Em branco, usamos o nome do cadastro."}
                error={errors.clientDisplayName}
                optional
              >
                <Input value={draft.clientDisplayName} maxLength={160} onChange={(event) => patch({ clientDisplayName: event.target.value })} />
              </Field>
            </FieldRow>
            <Field label="Contato" hint="Pessoa a quem a proposta é endereçada (aos cuidados de)." error={errors.contactName} optional>
              <Input value={draft.contactName} maxLength={160} onChange={(event) => patch({ contactName: event.target.value })} />
            </Field>
          </>
        )}

        <FieldRow cols={isTemplate ? 2 : 3}>
          {isTemplate ? null : (
            <Field label="Data do evento ou início" error={errors.eventDate} optional>
              <DateInput value={draft.eventDate ?? ""} onChange={(event) => patch({ eventDate: event.target.value })} />
            </Field>
          )}
          <Field label="Local" error={errors.eventLocation} optional>
            <Input value={draft.eventLocation} maxLength={200} onChange={(event) => patch({ eventLocation: event.target.value })} />
          </Field>
          {isTemplate ? null : (
            <Field
              label="Validade da proposta"
              error={errors.validUntil}
              hint={expired ? <span className="text-perigo font-semibold">Esta validade já passou.</span> : "Até quando os valores estão garantidos."}
              optional
            >
              <DateInput value={draft.validUntil ?? ""} onChange={(event) => patch({ validUntil: event.target.value })} />
            </Field>
          )}
        </FieldRow>
      </div>
    </Card>
  );
}

// --------------------------------------------------------------------- Escopo
const emptyItem = (kind: ProposalItemKind): DraftItem => ({ kind, title: "", description: "", quantity: 1, unit: "", unitPriceCents: 0 });
const itemHasContent = (item: DraftItem) => Boolean(item.description.trim() || item.unit.trim() || item.unitPriceCents > 0);

function ItemsList({
  kind,
  label,
  hint,
  emptyLabel,
  addLabel,
  draft,
  patch,
  attempted,
  listsKey,
}: Pick<StepProps, "draft" | "patch" | "attempted" | "listsKey"> & { kind: ProposalItemKind; label: string; hint: string; emptyLabel: string; addLabel: string }) {
  const own = draft.items.filter((item) => item.kind === kind);
  const max = DRAFT_LIMITS.items - (draft.items.length - own.length);
  const setOwn = (next: DraftItem[]) => {
    const typed = next.map((item) => ({ ...item, kind }));
    const others = draft.items.filter((item) => item.kind !== kind);
    // inclusos sempre antes dos opcionais (é também a ordem do PDF)
    patch({ items: kind === "incluso" ? [...typed, ...others] : [...others, ...typed] });
  };

  return (
    <ObjectListField<DraftItem>
      key={`${kind}-${listsKey}`}
      name={`itens-${kind}`}
      label={label}
      hint={hint}
      emptyLabel={emptyLabel}
      addLabel={addLabel}
      max={max}
      defaultValue={own}
      createItem={() => emptyItem(kind)}
      itemLabel={(item) => item.title}
      onChange={setOwn}
      renderItem={(item, update, index) => {
        const missingTitle = attempted && !item.title.trim() && itemHasContent(item);
        const total = lineTotalCents(item);
        return (
          <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 sm:grid-cols-12">
            <Mini label="Item" className="col-span-2 sm:col-span-12">
              <input
                className="input"
                value={item.title}
                maxLength={160}
                placeholder="Ex.: Filme de melhores momentos"
                aria-invalid={missingTitle || undefined}
                onChange={(event) => update({ title: event.target.value })}
              />
              {missingTitle ? <span className="field-error block">Dê um título ao item {index + 1}.</span> : null}
            </Mini>
            <Mini label="Quantidade" className="sm:col-span-3">
              <DecimalInput value={item.quantity} max={DRAFT_LIMITS.quantity} onValueChange={(quantity) => update({ quantity })} />
            </Mini>
            <Mini label="Unidade" className="sm:col-span-4">
              <input className="input" value={item.unit} maxLength={40} placeholder="horas, vídeos…" onChange={(event) => update({ unit: event.target.value })} />
            </Mini>
            <Mini label="Valor unitário" className="col-span-2 sm:col-span-5">
              <MoneyInput value={item.unitPriceCents || null} onValueChange={(cents) => update({ unitPriceCents: cents ?? 0 })} />
            </Mini>
            <Mini label="Descrição (opcional)" className="col-span-2 sm:col-span-12">
              <Textarea rows={1} value={item.description} maxLength={1000} onChange={(event) => update({ description: event.target.value })} />
            </Mini>
            {total > 0 && (item.quantity !== 1 || kind === "opcional") ? (
              <p className="text-cinza col-span-2 text-xs sm:col-span-12">
                Total do item: <strong className="text-grafite tabular-nums">{formatBRL(total)}</strong>
              </p>
            ) : null}
          </div>
        );
      }}
    />
  );
}

export function StepEscopo(props: StepProps) {
  const { draft, patch, numbers, errors } = props;
  return (
    <div className="space-y-4">
      <Card as="section" aria-labelledby="etapa-escopo-descricao">
        <CardHeader id="etapa-escopo-descricao" title="Descrição do projeto" description="O texto de abertura: o que será feito e para quê." />
        <Field label="Descrição do projeto" hideLabel hint={FORMAT_HINT} error={errors.intro}>
          <Textarea rows={4} value={draft.intro} maxLength={6000} onChange={(event) => patch({ intro: event.target.value })} />
        </Field>
      </Card>

      <Card as="section" aria-labelledby="etapa-escopo-itens">
        <CardHeader
          id="etapa-escopo-itens"
          title="Serviços e entregas"
          description="O valor pode ficar todo em um item (o pacote) e os demais sem valor — no PDF eles aparecem como “incluso”."
        />
        <div className="space-y-6">
          <ItemsList
            {...props}
            kind="incluso"
            label="Itens inclusos"
            hint={`Soma dos inclusos: ${formatBRL(numbers.client.itemsTotalCents)}`}
            emptyLabel="Nenhum item ainda. Adicione o que está incluso: cobertura, equipe, entregas, prazos, revisões…"
            addLabel="Adicionar item incluso"
          />
          <ItemsList
            {...props}
            kind="opcional"
            label="Opcionais"
            hint={`Não entram no total. No PDF aparecem à parte, cada um com o seu valor.${numbers.client.optionalsTotalCents > 0 ? ` Soma dos opcionais: ${formatBRL(numbers.client.optionalsTotalCents)}.` : ""}`}
            emptyLabel="Nenhum opcional. Use para extras que o cliente pode contratar à parte (ex.: álbum, drone, hora extra)."
            addLabel="Adicionar opcional"
          />
        </div>
        {errors.items ? <p className="field-error">{errors.items}</p> : null}
      </Card>

      <Card as="section" aria-labelledby="etapa-escopo-textos">
        <CardHeader id="etapa-escopo-textos" title="Cronograma e limites" />
        <div className="space-y-5">
          <Field label="Cronograma / duração da cobertura" hint="Etapas, prazos de entrega, duração, quantidade de revisões." error={errors.scheduleText} optional>
            <Textarea rows={3} value={draft.scheduleText} maxLength={6000} onChange={(event) => patch({ scheduleText: event.target.value })} />
          </Field>
          <Field label="Não incluso" hint="O que fica de fora, para evitar mal-entendido (ex.: deslocamento fora da cidade, álbum impresso)." error={errors.exclusions} optional>
            <Textarea rows={3} value={draft.exclusions} maxLength={6000} onChange={(event) => patch({ exclusions: event.target.value })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------- Preço
const emptyPayment = (): DraftPayment => ({ label: "", dueDate: null, dueLabel: "", amountCents: 0 });
const paymentHasContent = (payment: DraftPayment) => Boolean(payment.dueDate || payment.dueLabel.trim() || payment.amountCents > 0);

export function StepPreco({ draft, patch, numbers, errors, attempted, listsKey }: StepProps) {
  const [installments, setInstallments] = useState(1);
  const [paymentsKey, setPaymentsKey] = useState(0);
  const { client } = numbers;
  const difference = numbers.paymentsDifferenceCents;

  const suggest = () => {
    patch({ payments: suggestPayments(client, installments).map((line) => ({ label: line.label, amountCents: line.amountCents, dueDate: null, dueLabel: "" })) });
    setPaymentsKey((key) => key + 1);
  };

  return (
    <div className="space-y-4">
      <Card as="section" aria-labelledby="etapa-preco-total">
        <CardHeader id="etapa-preco-total" title="Preço ao cliente" description="Calculado a partir dos itens inclusos (etapa Escopo). É o que aparece em “Investimento” no PDF." />
        <dl className="divide-areia divide-y">
          <SumRow label="Itens inclusos" value={formatBRL(client.itemsTotalCents)} />
          {client.discountCents > 0 ? <SumRow label={draft.discountLabel.trim() || "Desconto"} value={`− ${formatBRL(client.discountCents)}`} /> : null}
          <SumRow strong label="Total ao cliente" value={formatBRL(client.totalCents)} />
          {client.optionalsTotalCents > 0 ? <SumRow label="Opcionais (fora do total)" value={formatBRL(client.optionalsTotalCents)} /> : null}
        </dl>
        <div className="border-areia mt-3 border-t pt-2">
          <Checkbox
            label="Mostrar o valor de cada item no PDF"
            hint="Desmarcado, o PDF mostra só o total. Os opcionais sempre aparecem com valor."
            checked={draft.showItemPrices}
            onChange={(event) => patch({ showItemPrices: event.target.checked })}
          />
        </div>
      </Card>

      <Card as="section" aria-labelledby="etapa-preco-desconto">
        <CardHeader id="etapa-preco-desconto" title="Desconto" description="Registre o desconto em negociação; ele só vale para o cliente depois de aprovado." />
        <div className="space-y-4">
          <FieldRow>
            <Field label="Valor do desconto" error={errors.discountCents} optional>
              <MoneyInput value={draft.discountCents || null} onValueChange={(cents) => patch({ discountCents: cents ?? 0 })} />
            </Field>
            <Field label="Como aparece no PDF" hint="Ex.: Desconto para pagamento à vista" error={errors.discountLabel} optional>
              <Input value={draft.discountLabel} maxLength={120} placeholder="Desconto" onChange={(event) => patch({ discountLabel: event.target.value })} />
            </Field>
          </FieldRow>
          <Checkbox
            label="Desconto aprovado (aparece no PDF)"
            hint="Marque quando os sócios concordarem. Só então o desconto reduz o total e entra no PDF."
            checked={draft.discountApproved}
            onChange={(event) => patch({ discountApproved: event.target.checked })}
          />
          {numbers.pendingDiscountCents > 0 ? (
            <Alert tone="alerta" title="Desconto ainda não aprovado">
              {formatBRL(numbers.pendingDiscountCents)} ficam só no painel: o total e o PDF continuam sem o desconto até você marcar “aprovado”.
            </Alert>
          ) : null}
          {draft.discountApproved && draft.discountCents > client.itemsTotalCents ? (
            <Alert tone="alerta">O desconto é maior que a soma dos itens; ele será limitado a {formatBRL(client.itemsTotalCents)}.</Alert>
          ) : null}
        </div>
      </Card>

      <Card as="section" aria-labelledby="etapa-preco-sinal">
        <CardHeader id="etapa-preco-sinal" title="Sinal / entrada" />
        <div className="space-y-4">
          <Field group label="Como definir o sinal">
            <RadioCards
              name="modo-sinal"
              compact
              cols={2}
              value={draft.entryMode}
              onValueChange={(value) => {
                const entryMode = value as EntryMode;
                // ao trocar de modo, o outro formato começa do valor equivalente
                patch(entryMode === "valor" ? { entryMode, entryCents: client.entryCents } : { entryMode, entryPercent: client.entryPercent });
              }}
              options={[
                { value: "percentual", label: "Percentual do total" },
                { value: "valor", label: "Valor fixo" },
              ]}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            {draft.entryMode === "percentual" ? (
              <Field label="Sinal (%)" hint="0 = sem sinal." error={errors.entryPercent}>
                <DecimalInput value={draft.entryPercent} max={100} suffix="%" onValueChange={(entryPercent) => patch({ entryPercent })} />
              </Field>
            ) : (
              <Field label="Sinal (valor)" hint="0 = sem sinal." error={errors.entryCents}>
                <MoneyInput value={draft.entryCents || null} onValueChange={(cents) => patch({ entryCents: cents ?? 0 })} />
              </Field>
            )}
            <dl className="bg-offwhite rounded-campo divide-areia divide-y px-4 py-1">
              <SumRow label={`Sinal${client.entryCents > 0 ? ` (${formatPercent(client.entryPercent)})` : ""}`} value={formatBRL(client.entryCents)} />
              <SumRow label="Saldo restante" value={formatBRL(client.balanceCents)} />
            </dl>
          </div>
        </div>
      </Card>

      <Card as="section" aria-labelledby="etapa-preco-parcelas">
        <CardHeader id="etapa-preco-parcelas" title="Parcelas e vencimentos" description="O plano de pagamento que aparece no PDF. Deixe vazio se as condições forem só em texto." />
        <div className="bg-lavanda-claro rounded-campo mb-4 flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-end">
          <label className="block sm:w-56">
            <span className="text-grafite mb-1 block text-sm font-semibold">Dividir o saldo em</span>
            <select className="input" value={installments} onChange={(event) => setInstallments(Number(event.target.value))}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count === 1 ? "1 parcela (saldo único)" : `${count} parcelas`}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" icon={<Sparkles />} onClick={suggest} disabled={client.totalCents <= 0}>
            {draft.payments.length > 0 ? "Recalcular parcelas" : "Sugerir parcelas"}
          </Button>
          <p className="text-cinza text-xs leading-snug sm:flex-1 sm:pb-1">
            {client.totalCents <= 0
              ? "Defina os valores dos itens para sugerir as parcelas."
              : draft.payments.length > 0
                ? "Substitui as linhas abaixo por entrada + saldo dividido."
                : "Cria a entrada e divide o saldo; depois ajuste rótulos e vencimentos."}
          </p>
        </div>

        <ObjectListField<DraftPayment>
          key={`parcelas-${listsKey}-${paymentsKey}`}
          name="parcelas"
          label="Parcelas"
          emptyLabel="Nenhuma parcela. Use “Sugerir parcelas” ou adicione à mão."
          addLabel="Adicionar parcela"
          max={DRAFT_LIMITS.payments}
          defaultValue={draft.payments}
          createItem={emptyPayment}
          itemLabel={(payment) => payment.label}
          onChange={(payments) => patch({ payments })}
          renderItem={(payment, update, index) => {
            const missingLabel = attempted && !payment.label.trim() && paymentHasContent(payment);
            return (
              <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 sm:grid-cols-12">
                <Mini label="Parcela" className="col-span-2 sm:col-span-7">
                  <input
                    className="input"
                    value={payment.label}
                    maxLength={120}
                    placeholder="Ex.: Entrada (30%)"
                    aria-invalid={missingLabel || undefined}
                    onChange={(event) => update({ label: event.target.value })}
                  />
                  {missingLabel ? <span className="field-error block">Dê um nome à parcela {index + 1}.</span> : null}
                </Mini>
                <Mini label="Valor" className="col-span-2 sm:col-span-5">
                  <MoneyInput value={payment.amountCents || null} onValueChange={(cents) => update({ amountCents: cents ?? 0 })} />
                </Mini>
                <Mini label="Vencimento (data)" className="col-span-2 sm:col-span-5">
                  <input
                    type="date"
                    className="input"
                    value={payment.dueDate ?? ""}
                    onChange={(event) => update(event.target.value ? { dueDate: event.target.value, dueLabel: "" } : { dueDate: null })}
                  />
                </Mini>
                <Mini label="ou em texto" className="col-span-2 sm:col-span-7">
                  <input
                    className="input"
                    value={payment.dueLabel}
                    maxLength={120}
                    placeholder="Ex.: na assinatura do contrato"
                    onChange={(event) => update(event.target.value ? { dueLabel: event.target.value, dueDate: null } : { dueLabel: "" })}
                  />
                </Mini>
              </div>
            );
          }}
        />
        {errors.payments ? <p className="field-error">{errors.payments}</p> : null}

        {draft.payments.length > 0 ? (
          difference === 0 ? (
            <p className="text-sucesso mt-3 flex items-center gap-2 text-sm font-semibold">
              <CalendarClock aria-hidden="true" className="size-4" />
              As parcelas somam {formatBRL(client.totalCents)} — fecham com o total.
            </p>
          ) : (
            <Alert tone="alerta" role="status" className="mt-3" title="A soma das parcelas não fecha com o total">
              As parcelas somam {formatBRL(client.totalCents + difference)} e o total é {formatBRL(client.totalCents)}:{" "}
              <strong>{difference > 0 ? `sobram ${formatBRL(difference)}` : `faltam ${formatBRL(-difference)}`}</strong>. Ajuste os valores ou use “Recalcular parcelas”.
              {draft.discountCents > 0 && !draft.discountApproved ? (
                <> Enquanto o desconto não estiver aprovado e as parcelas não fecharem com o total, <strong>elas não entram no PDF</strong> (para o desconto pendente não aparecer para o cliente).</>
              ) : null}
            </Alert>
          )
        ) : null}
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------- Textos
export function StepTextos({ draft, patch, errors }: StepProps) {
  return (
    <Card as="section" aria-labelledby="etapa-textos">
      <CardHeader
        id="etapa-textos"
        title="Textos comerciais"
        description={
          <>
            Vão para o PDF depois do investimento. Os textos padrão de propostas novas ficam em{" "}
            <Link href="/painel/config/propostas" className="link">
              Configurações › Propostas
            </Link>
            .
          </>
        }
      />
      <div className="space-y-5">
        <Field label="Condições de pagamento" hint="Formas de pagamento, chave Pix, multa por atraso… Complementa a tabela de parcelas." error={errors.paymentNotes} optional>
          <Textarea rows={4} value={draft.paymentNotes} maxLength={6000} onChange={(event) => patch({ paymentNotes: event.target.value })} />
        </Field>
        <Field label="Observações e condições comerciais" hint={`Remarcação, cancelamento, direitos de uso de imagem, prazos. ${FORMAT_HINT}`} error={errors.conditions} optional>
          <Textarea rows={6} value={draft.conditions} maxLength={8000} onChange={(event) => patch({ conditions: event.target.value })} />
        </Field>
      </div>
    </Card>
  );
}

/** Data formatada para avisos do editor. */
export const editorDate = (iso: string | null | undefined) => (iso ? formatDate(iso) : "");
