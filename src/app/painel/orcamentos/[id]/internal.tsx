"use client";

/**
 * Etapa "Cálculo interno": custos, rateio, tributos, margem e notas. SÓ PAINEL — nada daqui vai para o PDF
 * (o PDF é gerado apenas a partir de `toPublicProposal()`, que nem recebe estes campos).
 */
import { Lock, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, FieldRow } from "@/components/ui/form";
import { Textarea } from "@/components/ui/input";
import { ObjectListField } from "@/components/ui/list-fields";
import { MoneyInput } from "@/components/ui/masked-inputs";
import { PROPOSAL_COST_CATEGORIES, PROPOSAL_COST_CATEGORY_LABELS, type ProposalCostCategory } from "@/lib/domain";
import { formatBRL, formatPercent } from "@/lib/format";
import { DRAFT_LIMITS, type DraftCost } from "../draft";
import { DecimalInput, Mini, SumRow } from "./fields";
import type { StepProps } from "./steps";

const emptyCost = (): DraftCost => ({ category: "equipe", description: "", amountCents: 0 });
const pct = (value: number | null) => (value === null ? "—" : formatPercent(value));

/** Faixa que torna impossível confundir esta área com o que vai para o cliente. */
function PrivateBanner({ isTemplate }: { isTemplate: boolean }) {
  return (
    <div role="note" className="bg-roxo-noite rounded-cartao border-lima flex items-start gap-3 border-2 px-4 py-3.5 text-white sm:items-center sm:px-5">
      <Lock aria-hidden="true" className="text-lima mt-0.5 size-6 shrink-0 sm:mt-0" />
      <div className="min-w-0">
        <p className="text-lima text-sm font-extrabold tracking-wide uppercase">Só painel — não aparece no PDF</p>
        <p className="mt-0.5 text-sm leading-snug text-white/85">
          Custos, rateio, tributos, margem e notas desta etapa são só para vocês dois. O PDF e qualquer página para o cliente nunca recebem esses dados.
          {isTemplate ? " No modelo, servem de referência para as propostas criadas a partir dele." : ""}
        </p>
      </div>
    </div>
  );
}

export function StepInterno({ draft, patch, numbers, errors, listsKey, isTemplate }: StepProps & { isTemplate: boolean }) {
  const { client, internal } = numbers;
  const priceKnown = client.totalCents > 0;

  const byCategory = PROPOSAL_COST_CATEGORIES.map((category) => ({
    category,
    cents: draft.costs.filter((cost) => cost.category === category).reduce((total, cost) => total + (cost.amountCents || 0), 0),
  })).filter((entry) => entry.cents > 0);

  const profitTone = internal.profitCents < 0 ? "text-perigo" : "text-sucesso";

  return (
    <div className="space-y-4">
      <PrivateBanner isTemplate={isTemplate} />

      <Card as="section" aria-labelledby="etapa-interno-custos" className="border-roxo/25 border-2 border-dashed">
        <CardHeader
          id="etapa-interno-custos"
          title="Custos diretos"
          description="O que custa executar este trabalho: equipe, locação, deslocamento, pós-produção e outras despesas."
        />
        <ObjectListField<DraftCost>
          key={`custos-${listsKey}`}
          name="custos"
          label="Custos por categoria"
          emptyLabel="Nenhum custo ainda. Adicione equipe, locação, deslocamento… para ver o resultado e a margem."
          addLabel="Adicionar custo"
          max={DRAFT_LIMITS.costs}
          defaultValue={draft.costs}
          createItem={emptyCost}
          itemLabel={(cost) => cost.description || PROPOSAL_COST_CATEGORY_LABELS[cost.category]}
          onChange={(costs) => patch({ costs })}
          renderItem={(cost, update) => (
            <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 sm:grid-cols-12">
              <Mini label="Categoria" className="col-span-2 sm:col-span-4">
                <select className="input" value={cost.category} onChange={(event) => update({ category: event.target.value as ProposalCostCategory })}>
                  {PROPOSAL_COST_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {PROPOSAL_COST_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </Mini>
              <Mini label="Descrição" className="col-span-2 sm:col-span-5">
                <input className="input" value={cost.description} maxLength={200} placeholder="Ex.: 2 freelancers, diária" onChange={(event) => update({ description: event.target.value })} />
              </Mini>
              <Mini label="Valor" className="col-span-2 sm:col-span-3">
                <MoneyInput value={cost.amountCents || null} onValueChange={(cents) => update({ amountCents: cents ?? 0 })} />
              </Mini>
            </div>
          )}
        />
        {errors.costs ? <p className="field-error">{errors.costs}</p> : null}
        {byCategory.length > 0 ? (
          <dl className="bg-offwhite rounded-campo divide-areia mt-4 divide-y px-4 py-1">
            {byCategory.map((entry) => (
              <SumRow key={entry.category} label={PROPOSAL_COST_CATEGORY_LABELS[entry.category]} value={formatBRL(entry.cents)} className="py-1.5" />
            ))}
            <SumRow strong label="Custo direto" value={formatBRL(internal.directCostCents)} />
          </dl>
        ) : null}
      </Card>

      <Card as="section" aria-labelledby="etapa-interno-premissas" className="border-roxo/25 border-2 border-dashed">
        <CardHeader
          id="etapa-interno-premissas"
          title="Rateio, tributos e meta"
          description="Premissas da conta. Os padrões vêm de Configurações › Propostas e valem só para esta proposta."
        />
        <div className="space-y-4">
          <Field label="Rateio de despesas do estúdio" hint="Parte das despesas fixas (internet, software, contador…) atribuída a este trabalho." error={errors.overheadCents} optional>
            <MoneyInput value={draft.overheadCents || null} onValueChange={(cents) => patch({ overheadCents: cents ?? 0 })} />
          </Field>
          <FieldRow>
            <Field label="Tributos estimados (%)" hint="Percentual do preço ao cliente. Estimativa, não é apuração fiscal." error={errors.taxPercent}>
              <DecimalInput value={draft.taxPercent} max={100} suffix="%" onValueChange={(taxPercent) => patch({ taxPercent })} />
            </Field>
            <Field label="Margem-alvo (%)" hint="Margem líquida que vocês querem ter neste tipo de trabalho." error={errors.targetMarginPercent}>
              <DecimalInput value={draft.targetMarginPercent} max={100} suffix="%" onValueChange={(targetMarginPercent) => patch({ targetMarginPercent })} />
            </Field>
          </FieldRow>
          <Field label="Notas internas" hint="Combinados, riscos, negociação… Só aparecem aqui no painel." error={errors.internalNotes} optional>
            <Textarea rows={4} value={draft.internalNotes} maxLength={8000} onChange={(event) => patch({ internalNotes: event.target.value })} />
          </Field>
        </div>
      </Card>

      <Card as="section" aria-labelledby="etapa-interno-resultado" className="border-roxo/25 border-2 border-dashed">
        <CardHeader id="etapa-interno-resultado" title="Resultado estimado" description="Atualiza enquanto você digita. Usa o preço ao cliente da etapa Preço." />

        {!priceKnown ? (
          <Alert tone="info" className="mb-3">
            Ainda não há preço ao cliente (itens inclusos sem valor). Preencha o escopo para ver resultado e margem.
          </Alert>
        ) : null}

        {priceKnown && internal.belowTarget ? (
          <Alert tone="alerta" role="status" className="mb-3" title="Abaixo da margem-alvo">
            A margem líquida estimada é <strong>{pct(internal.netMarginPercent)}</strong> e a meta é <strong>{formatPercent(internal.targetMarginPercent)}</strong>.
            {internal.suggestedPriceCents !== null ? (
              <>
                {" "}
                Para chegar na meta com estes custos, o preço seria <strong>{formatBRL(internal.suggestedPriceCents)}</strong>.
              </>
            ) : (
              " Com estes tributos e esta meta somando 100% ou mais, nenhum preço atinge a meta."
            )}
          </Alert>
        ) : null}
        {priceKnown && internal.belowTarget === false ? (
          <Alert tone="sucesso" className="mb-3">
            Dentro da meta: margem líquida estimada de <strong>{pct(internal.netMarginPercent)}</strong> (meta {formatPercent(internal.targetMarginPercent)}).
          </Alert>
        ) : null}

        <dl className="divide-areia divide-y">
          <SumRow label="Preço ao cliente" value={formatBRL(client.totalCents)} />
          <SumRow label="Custo direto" value={formatBRL(internal.directCostCents)} />
          <SumRow label="Rateio de despesas" value={formatBRL(internal.overheadCents)} />
          <SumRow label="Tributos estimados" value={formatBRL(internal.taxCents)} hint={`${formatPercent(draft.taxPercent)} do preço`} />
          <SumRow label="Custo total" value={formatBRL(internal.totalCostCents)} hint="direto + rateio + tributos" />
          <SumRow
            strong
            label={
              <span className="inline-flex items-center gap-1.5">
                {internal.profitCents < 0 ? <TrendingDown aria-hidden="true" className="text-perigo size-4" /> : <TrendingUp aria-hidden="true" className="text-sucesso size-4" />}
                Resultado estimado
              </span>
            }
            value={<span className={profitTone}>{formatBRL(internal.profitCents)}</span>}
            hint="preço − custo total"
          />
          <SumRow label="Margem de contribuição" value={pct(internal.contributionMarginPercent)} hint="(preço − custos diretos − tributos) ÷ preço" />
          <SumRow label="Margem líquida" value={<span className={profitTone}>{pct(internal.netMarginPercent)}</span>} hint="resultado ÷ preço" />
          <SumRow label="Markup" value={pct(internal.markupPercent)} hint="resultado ÷ custo total" />
          <SumRow
            label={
              <span className="inline-flex items-center gap-1.5">
                <Target aria-hidden="true" className="text-roxo size-4" />
                Preço sugerido para a meta
              </span>
            }
            value={internal.suggestedPriceCents !== null ? formatBRL(internal.suggestedPriceCents) : "—"}
            hint={internal.suggestedPriceCents !== null ? `margem líquida de ${formatPercent(internal.targetMarginPercent)} com os custos atuais` : "defina uma margem-alvo maior que zero"}
          />
        </dl>

        <p className="bg-lavanda-claro rounded-campo text-grafite mt-4 px-4 py-3 text-sm leading-relaxed">
          <strong>Margem não é markup.</strong> A margem é o lucro dividido pelo <em>preço</em>; o markup é o lucro dividido pelo <em>custo</em>. Um markup de 50% equivale a
          uma margem de 33%. Para a meta de margem, olhe a margem líquida.
        </p>
      </Card>
    </div>
  );
}
