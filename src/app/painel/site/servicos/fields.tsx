"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ObjectListField } from "@/components/ui/list-fields";
import type { ServiceBenefit, ServiceFaq } from "@/db/schema";

/** Benefícios do serviço (título + frase). Linhas sem título são descartadas ao salvar. */
export function BenefitsField({ defaultValue }: { defaultValue: ServiceBenefit[] }) {
  return (
    <ObjectListField<ServiceBenefit>
      name="benefits"
      label="Benefícios"
      hint="O que o cliente ganha com este serviço. Sem itens, a página do serviço não mostra este bloco."
      defaultValue={defaultValue}
      addLabel="Adicionar benefício"
      max={12}
      emptyLabel="Nenhum benefício cadastrado: o bloco não aparece no site."
      createItem={() => ({ title: "", text: "" })}
      itemLabel={(item, index) => item.title || `Benefício ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid gap-2">
          <input className="input" aria-label={`Benefício ${index + 1}: título`} placeholder="Título" maxLength={120} value={item.title} onChange={(event) => update({ title: event.target.value })} />
          <textarea
            className="input"
            rows={2}
            aria-label={`Benefício ${index + 1}: texto`}
            placeholder="Frase curta (opcional)"
            maxLength={400}
            value={item.text}
            onChange={(event) => update({ text: event.target.value })}
          />
        </div>
      )}
    />
  );
}

/** Perguntas frequentes do serviço. Só aparecem no site as que têm pergunta E resposta. */
export function ServiceFaqField({ defaultValue }: { defaultValue: ServiceFaq[] }) {
  return (
    <ObjectListField<ServiceFaq>
      name="faq"
      label="Perguntas frequentes do serviço"
      hint="Só aparecem no site as perguntas com resposta. Sem nenhuma, a página do serviço não mostra este bloco."
      defaultValue={defaultValue}
      addLabel="Adicionar pergunta"
      max={20}
      emptyLabel="Nenhuma pergunta cadastrada: o bloco não aparece no site."
      createItem={() => ({ question: "", answer: "" })}
      itemLabel={(item, index) => item.question || `Pergunta ${index + 1}`}
      renderItem={(item, update, index) => (
        <div className="grid gap-2">
          <input className="input" aria-label={`Pergunta ${index + 1}`} placeholder="Pergunta" maxLength={200} value={item.question} onChange={(event) => update({ question: event.target.value })} />
          <textarea
            className="input"
            rows={3}
            aria-label={`Resposta da pergunta ${index + 1}`}
            placeholder="Resposta (enquanto estiver vazia, a pergunta não aparece no site)"
            maxLength={2000}
            value={item.answer}
            onChange={(event) => update({ answer: event.target.value })}
          />
        </div>
      )}
    />
  );
}

/** Projetos do portfólio relacionados ao serviço: caixas de seleção; o valor vai como JSON (lista de ids). */
export function RelatedProjectsField({
  options,
  defaultValue,
}: {
  options: { id: number; title: string; published: boolean }[];
  defaultValue: number[];
}) {
  const [selected, setSelected] = useState<number[]>(() => defaultValue.filter((id) => options.some((option) => option.id === id)));
  const toggle = (id: number, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)));
  return (
    <fieldset>
      <legend className="label">Trabalhos relacionados</legend>
      <p className="text-texto-suave mb-2 text-sm">
        Projetos do portfólio que mostram este serviço. Só os publicados aparecem na página do serviço — e só com o Portfólio ligado. Sem nenhum, o bloco não aparece.
      </p>
      <input type="hidden" name="relatedProjectIds" value={JSON.stringify(selected)} />
      {options.length === 0 ? (
        <p className="text-texto-suave border-borda-forte rounded-campo border border-dashed px-3 py-2.5 text-sm">
          Ainda não há projetos no portfólio. Cadastre em Editar site → Portfólio e volte aqui para relacionar.
        </p>
      ) : (
        <ul className="border-borda rounded-campo divide-borda divide-y border">
          {options.map((option) => (
            <li key={option.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primaria size-5 shrink-0"
                  checked={selected.includes(option.id)}
                  onChange={(event) => toggle(option.id, event.target.checked)}
                  data-controlled=""
                />
                <span className="text-texto min-w-0 flex-1 break-words font-semibold">{option.title}</span>
                {option.published ? <Badge tone="sucesso">Publicado</Badge> : <Badge tone="neutral">Rascunho</Badge>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}
