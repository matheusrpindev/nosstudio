"use client";

/**
 * Campos próprios do formulário de projeto do portfólio. Os uploads usam os campos do kit (`ImageField`, que
 * envia para /painel/api/media); aqui só se monta o que é específico do portfólio.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useFieldState } from "@/components/ui/form";
import { RadioCards } from "@/components/ui/input";
import { ObjectListField } from "@/components/ui/list-fields";
import { ImageField, type MediaValue } from "@/components/ui/media-fields";
import { PORTFOLIO_ORIGIN_LABELS, PORTFOLIO_ORIGINS, type PortfolioOrigin } from "@/lib/domain";
import { PORTFOLIO_LIMITS } from "./limits";

// ---------------------------------------------------------------- antes e depois
type PairValue = { beforeMediaId: number | null; afterMediaId: number | null; caption: string };
export type BeforeAfterDefault = { before: MediaValue | null; after: MediaValue | null; caption: string };

/**
 * Pares "antes e depois": duas imagens (cada uma com o seu texto alternativo) e uma legenda. O valor vai como
 * JSON em `beforeAfter`; os campos de imagem de dentro só fazem o upload (o `name` deles é ignorado no servidor).
 */
export function BeforeAfterField({ defaultValue }: { defaultValue: BeforeAfterDefault[] }) {
  // as imagens já salvas, para a prévia de cada linha (as novas ficam no estado do próprio campo de imagem)
  const [saved] = useState(() => new Map(defaultValue.flatMap((pair) => [pair.before, pair.after]).flatMap((media) => (media ? [[media.id, media] as const] : []))));
  return (
    <ObjectListField<PairValue>
      name="beforeAfter"
      label="Pares de antes e depois"
      hint="Cada par vira um controle deslizante no site: o visitante arrasta para comparar. Use duas imagens com o mesmo enquadramento e a mesma proporção. Sem nenhum par, o bloco não aparece."
      defaultValue={defaultValue.map((pair) => ({ beforeMediaId: pair.before?.id ?? null, afterMediaId: pair.after?.id ?? null, caption: pair.caption }))}
      addLabel="Adicionar par"
      max={PORTFOLIO_LIMITS.beforeAfter}
      emptyLabel="Nenhum par cadastrado: o bloco não aparece no site."
      createItem={() => ({ beforeMediaId: null, afterMediaId: null, caption: "" })}
      itemLabel={(item, index) => item.caption || `Par ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid gap-4">
          <ImageField
            name={`_antes-${index}`}
            label={`Par ${index + 1} · Antes`}
            aspect="4/3"
            defaultValue={item.beforeMediaId ? (saved.get(item.beforeMediaId) ?? null) : null}
            onChange={(media) => update({ beforeMediaId: media?.id ?? null })}
          />
          <ImageField
            name={`_depois-${index}`}
            label={`Par ${index + 1} · Depois`}
            aspect="4/3"
            defaultValue={item.afterMediaId ? (saved.get(item.afterMediaId) ?? null) : null}
            onChange={(media) => update({ afterMediaId: media?.id ?? null })}
          />
          <div>
            <label className="label" htmlFor={`par-legenda-${index}`}>
              Legenda <span className="text-texto-suave font-normal">(opcional)</span>
            </label>
            <input
              id={`par-legenda-${index}`}
              className="input"
              maxLength={PORTFOLIO_LIMITS.caption}
              placeholder="Ex.: Fachada antes e depois da nova identidade"
              value={item.caption}
              onChange={(event) => update({ caption: event.target.value })}
            />
          </div>
        </div>
      )}
    />
  );
}

// ------------------------------------------------------------------- relacionados
/** Projetos relacionados: caixas de seleção; o valor vai como JSON (lista de ids, na ordem do painel). */
export function RelatedField({ options, defaultValue }: { options: { id: number; title: string; published: boolean }[]; defaultValue: number[] }) {
  const [selected, setSelected] = useState<number[]>(() => defaultValue.filter((id) => options.some((option) => option.id === id)));
  const { error } = useFieldState("relatedProjectIds");
  const full = selected.length >= PORTFOLIO_LIMITS.related;
  const toggle = (id: number, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)));
  return (
    <fieldset>
      <legend className="label">Projetos relacionados</legend>
      <p className="text-texto-suave mb-2 text-sm">
        Aparecem no fim da página deste projeto (até {PORTFOLIO_LIMITS.related}). Só os publicados são mostrados. Sem nenhum escolhido, o site mostra outros projetos publicados da mesma categoria.
      </p>
      <input type="hidden" name="relatedProjectIds" value={JSON.stringify(options.filter((option) => selected.includes(option.id)).map((option) => option.id))} />
      {options.length === 0 ? (
        <p className="text-texto-suave border-borda-forte rounded-campo border border-dashed px-3 py-2.5 text-sm">Ainda não há outros projetos cadastrados.</p>
      ) : (
        <ul className="border-borda rounded-campo divide-borda divide-y border">
          {options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <li key={option.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primaria size-5 shrink-0"
                    checked={checked}
                    disabled={!checked && full}
                    onChange={(event) => toggle(option.id, event.target.checked)}
                    data-controlled=""
                  />
                  <span className="text-texto min-w-0 flex-1 font-semibold break-words">{option.title}</span>
                  {option.published ? <Badge tone="sucesso">Publicado</Badge> : <Badge tone="neutral">Rascunho</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

// ------------------------------------------------------------------------- origem
const ORIGIN_DESCRIPTIONS: Record<PortfolioOrigin, string> = {
  nos: "Feito pela NÓS Studio.",
  experiencia_anterior: "Feito por um dos fundadores antes da NÓS. O site avisa isso no cartão e na página do projeto.",
};

/** Origem do trabalho + a observação que acompanha o aviso de "experiência anterior". */
export function OriginField({ defaultOrigin, defaultNote }: { defaultOrigin: PortfolioOrigin; defaultNote: string }) {
  const [origin, setOrigin] = useState<PortfolioOrigin>(defaultOrigin);
  const [note, setNote] = useState(defaultNote);
  const { error } = useFieldState("originNote");
  return (
    <fieldset className="min-w-0">
      <legend className="label">Origem do trabalho</legend>
      <RadioCards
        name="origin"
        value={origin}
        onValueChange={(value) => setOrigin(value as PortfolioOrigin)}
        options={PORTFOLIO_ORIGINS.map((value) => ({ value, label: PORTFOLIO_ORIGIN_LABELS[value], description: ORIGIN_DESCRIPTIONS[value] }))}
      />
      {origin === "experiencia_anterior" ? (
        <div className="mt-4">
          <label className="label" htmlFor="portfolio-origem-nota">
            Observação sobre a origem <span className="text-texto-suave font-normal">(opcional)</span>
          </label>
          <input
            id="portfolio-origem-nota"
            name="originNote"
            className="input"
            maxLength={PORTFOLIO_LIMITS.originNote}
            placeholder="Ex.: Trabalho de Pedro Henrique antes da NÓS Studio."
            value={note}
            aria-invalid={error ? true : undefined}
            aria-describedby="portfolio-origem-nota-ajuda"
            onChange={(event) => setNote(event.target.value)}
            data-controlled=""
          />
          {error ? <p className="field-error">{error}</p> : null}
          <p className="hint" id="portfolio-origem-nota-ajuda">
            Aparece no site junto do aviso de experiência anterior. Diga de quem é o trabalho e, se quiser, onde foi feito.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
