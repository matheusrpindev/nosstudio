import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import { Switch } from "@/components/ui/switch";
import { PACKAGE_KIND_LABELS } from "@/lib/domain";
import type { Package } from "@/db/schema";
import { DeliverablesField, PriceFields } from "./fields";

/** Formulário de plano mensal ou serviço avulso. `pkg` nulo = novo. `basePlans`: os outros planos mensais. */
export function PackageForm({
  action,
  pkg,
  defaultKind,
  basePlans,
}: {
  action: FormAction;
  pkg: Package | null;
  defaultKind?: "plano" | "avulso";
  basePlans: { id: number; name: string }[];
}) {
  const baseOptions = [{ value: "", label: "Nenhum (lista só as próprias entregas)" }, ...basePlans.map((plan) => ({ value: String(plan.id), label: `Tudo do ${plan.name}, mais…` }))];
  return (
    <ActionForm action={action} hidden={{ id: pkg?.id }}>
      <FieldRow>
        <Field name="kind" label="Tipo" required hint="Planos mensais e serviços avulsos aparecem em blocos separados.">
          <Select options={PACKAGE_KIND_LABELS} defaultValue={pkg?.kind ?? defaultKind ?? "plano"} />
        </Field>
        <Field name="name" label="Nome" required>
          <Input maxLength={120} autoComplete="off" defaultValue={pkg?.name} />
        </Field>
      </FieldRow>
      <Field name="tagline" label="Chamada" optional hint="Uma frase curta, como “Para marcas que querem constância”.">
        <Input maxLength={200} defaultValue={pkg?.tagline} />
      </Field>
      <Field name="description" label="Descrição" optional>
        <Textarea rows={3} maxLength={2000} defaultValue={pkg?.description} />
      </Field>
      <StringListField
        name="includes"
        label="O que inclui"
        hint="Uma entrega por linha. É daqui que sai a tabela comparativa: escreva a mesma entrega do mesmo jeito em todos os planos."
        defaultValue={pkg?.includes ?? []}
        placeholder="Ex.: Planejamento mensal"
        addLabel="Adicionar entrega"
        max={30}
        maxLength={160}
        emptyLabel="Nenhuma entrega listada ainda."
      />
      <Field
        name="basePackageId"
        label="Plano-base"
        optional
        hint="Só para planos mensais. Com um plano-base, o site mostra “Tudo do plano tal, mais:” e a tabela comparativa marca também as entregas herdadas."
      >
        <Select options={baseOptions} defaultValue={pkg?.basePackageId ? String(pkg.basePackageId) : ""} />
      </Field>
      <DeliverablesField defaultValue={pkg?.deliverables ?? []} />

      <FieldRow>
        <Field name="recordingDuration" label="Duração das gravações" optional hint="Só se estiver definido. Ex.: até 4 horas por diária.">
          <Input maxLength={120} defaultValue={pkg?.recordingDuration} />
        </Field>
        <Field name="revisionLimit" label="Limite de revisões" optional hint="Só se estiver definido. Ex.: 2 rodadas.">
          <Input maxLength={120} defaultValue={pkg?.revisionLimit} />
        </Field>
      </FieldRow>

      <StringListField
        name="optionals"
        label="Opcionais"
        hint="O que pode ser acrescentado ao plano (ex.: tráfego pago, diária extra). Sem itens, o site não mostra esta parte."
        defaultValue={pkg?.optionals ?? []}
        placeholder="Ex.: Diária extra de captação"
        addLabel="Adicionar opcional"
        max={20}
        maxLength={160}
        emptyLabel="Nenhum opcional cadastrado."
      />

      <PriceFields mode={pkg?.priceMode ?? "sob_consulta"} priceCents={pkg?.priceCents ?? null} suffix={pkg?.priceSuffix ?? ""} discount={pkg?.discountNote ?? ""} />

      <Field name="ctaLabel" label="Texto do botão" required>
        <Input maxLength={40} defaultValue={pkg?.ctaLabel ?? "Solicitar orçamento"} />
      </Field>

      <div className="space-y-1">
        <Switch name="recommended" label="Plano em destaque" hint="Ganha o bloco roxo e a etiqueta (“Recomendado”) no site. Dá para destacar qualquer plano — ou nenhum." defaultChecked={pkg?.recommended ?? false} />
        <Switch name="visible" label="Mostrar no site" hint="Desligado, fica guardado aqui (rascunho) e não aparece para os visitantes." defaultChecked={pkg?.visible ?? true} />
      </div>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{pkg ? "Salvar" : "Criar"}</SubmitButton>
        <ButtonLink href="/painel/site/pacotes" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
