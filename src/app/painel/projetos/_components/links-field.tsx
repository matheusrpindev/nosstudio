"use client";

import type { LabeledLink } from "@/db/schema";
import { ObjectListField } from "@/components/ui/list-fields";

/** Links extras rotulados (ex.: "Making of" → https://…). Vai no formulário como JSON em `links`. */
export function ExtraLinksField({ defaultValue }: { defaultValue: LabeledLink[] }) {
  return (
    <ObjectListField<LabeledLink>
      name="links"
      label="Outros links"
      hint="Qualquer outro endereço útil: vídeo de teaser, pasta de áudio, cloud do cliente…"
      defaultValue={defaultValue}
      addLabel="Adicionar link"
      emptyLabel="Nenhum link extra."
      max={15}
      createItem={() => ({ label: "", url: "" })}
      itemLabel={(item, index) => item.label || `Link extra ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <input className="input" aria-label={`Nome do link extra ${index + 1}`} placeholder="Nome (ex.: Making of)" maxLength={60} value={item.label} onChange={(event) => update({ label: event.target.value })} />
          <input
            className="input"
            type="url"
            inputMode="url"
            aria-label={`Endereço do link extra ${index + 1}`}
            placeholder="https://…"
            maxLength={500}
            value={item.url}
            onChange={(event) => update({ url: event.target.value })}
          />
        </div>
      )}
    />
  );
}
