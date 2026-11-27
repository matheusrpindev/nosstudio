"use client";

import { useState } from "react";
import { Field, FieldRow } from "@/components/ui/form";
import { Input, Select } from "@/components/ui/input";
import { ObjectListField } from "@/components/ui/list-fields";
import { MoneyInput } from "@/components/ui/masked-inputs";
import { formatBRL } from "@/lib/format";
import { PRICE_MODE_LABELS, type PriceMode } from "@/lib/domain";

type Deliverable = { label: string; quantity: string };

/** Entregas com quantidade ("Reels" — "8 por mês"). Linhas sem nome são descartadas ao salvar. */
export function DeliverablesField({ defaultValue }: { defaultValue: Deliverable[] }) {
  return (
    <ObjectListField<Deliverable>
      name="deliverables"
      label="Entregas e quantidades"
      hint="Só preencha quantidades que os sócios já aprovaram. Sem itens, o site não mostra esta parte."
      defaultValue={defaultValue}
      addLabel="Adicionar entrega"
      max={30}
      emptyLabel="Nenhuma entrega com quantidade. O pacote aparece só com os serviços incluídos."
      createItem={() => ({ label: "", quantity: "" })}
      itemLabel={(item, index) => item.label || `Entrega ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_11rem]">
          <input className="input" aria-label={`Entrega ${index + 1}: o que é`} placeholder="Ex.: Reels" maxLength={120} value={item.label} onChange={(event) => update({ label: event.target.value })} />
          <input className="input" aria-label={`Entrega ${index + 1}: quantidade`} placeholder="Ex.: 8 por mês" maxLength={60} value={item.quantity} onChange={(event) => update({ quantity: event.target.value })} />
        </div>
      )}
    />
  );
}

/** Modo do preço + valor + complemento, com a frase final como o visitante vai ler. */
export function PriceFields({ mode: initialMode, priceCents, suffix, discount }: { mode: PriceMode; priceCents: number | null; suffix: string; discount: string }) {
  const [mode, setMode] = useState<PriceMode>(initialMode);
  const [cents, setCents] = useState<number | null>(priceCents);
  const [complement, setComplement] = useState(suffix);

  const preview =
    mode === "sob_consulta"
      ? "o texto padrão (“Investimento personalizado para o seu negócio.”), sem valor"
      : `${mode === "a_partir" ? "A partir de " : ""}${cents ? formatBRL(cents) : "R$ —"}${complement ? ` ${complement}` : ""}`;

  return (
    <div className="space-y-4">
      <FieldRow cols={3}>
        <Field name="priceMode" label="Como o valor aparece" required hint="“Valor oculto” guarda o valor aqui sem mostrá-lo no site.">
          <Select options={PRICE_MODE_LABELS} value={mode} onChange={(event) => setMode(event.target.value as PriceMode)} />
        </Field>
        <Field name="price" label="Valor" required={mode !== "sob_consulta"} optional={mode === "sob_consulta"}>
          <MoneyInput value={cents} onValueChange={setCents} />
        </Field>
        <Field name="priceSuffix" label="Complemento" optional hint="Ex.: /mês, por diária">
          <Input maxLength={40} value={complement} onChange={(event) => setComplement(event.target.value)} />
        </Field>
      </FieldRow>
      <Field name="discountNote" label="Desconto ou condição" optional hint="Ex.: “10% no contrato semestral”. Aparece logo abaixo do valor — e só quando o valor está publicado.">
        <Input maxLength={160} defaultValue={discount} />
      </Field>
      <p className="text-texto-suave text-sm" aria-live="polite">
        No site aparece: <strong className="text-texto">{preview}</strong>
      </p>
    </div>
  );
}
