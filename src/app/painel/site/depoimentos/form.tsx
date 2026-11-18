"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, RadioCards, Textarea } from "@/components/ui/input";
import { ImageField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { TESTIMONIAL_KIND_LABELS, TESTIMONIAL_KINDS, type TestimonialKind } from "@/lib/domain";

export type TestimonialFormValues = {
  id: number | null;
  kind: TestimonialKind;
  authorName: string;
  authorRole: string;
  content: string;
  mediaAlt: string;
  videoUrl: string;
  authorized: boolean;
  published: boolean;
};

const KIND_HINTS: Record<TestimonialKind, string> = {
  texto: "Uma frase ou parágrafo escrito pelo cliente, com foto opcional.",
  print: "Imagem de uma conversa em que o cliente elogia o trabalho.",
  video: "Vídeo do cliente, no YouTube ou no Vimeo.",
};

/** Formulário de depoimento: os campos mudam conforme o tipo escolhido. */
export function TestimonialForm({ action, initial, media }: { action: FormAction; initial: TestimonialFormValues; media: MediaValue | null }) {
  const [kind, setKind] = useState<TestimonialKind>(initial.kind);

  return (
    <ActionForm action={action} hidden={{ id: initial.id }}>
      <Field name="kind" label="Tipo de depoimento" group required>
        <RadioCards
          cols={3}
          value={kind}
          onValueChange={(value) => setKind(value as TestimonialKind)}
          options={TESTIMONIAL_KINDS.map((value) => ({ value, label: TESTIMONIAL_KIND_LABELS[value], description: KIND_HINTS[value] }))}
        />
      </Field>

      <FieldRow>
        <Field name="authorName" label="Quem deu o depoimento" required>
          <Input maxLength={120} autoComplete="off" defaultValue={initial.authorName} />
        </Field>
        <Field name="authorRole" label="Empresa ou relação com a NÓS" optional hint="Ex.: Noiva, Café do Bairro">
          <Input maxLength={160} autoComplete="off" defaultValue={initial.authorRole} />
        </Field>
      </FieldRow>

      <Field
        name="content"
        label={kind === "texto" ? "Depoimento" : "Legenda"}
        required={kind === "texto"}
        optional={kind !== "texto"}
        hint={kind === "texto" ? "Copie as palavras do cliente, sem melhorar o texto." : "Texto curto de apoio, se quiser."}
      >
        <Textarea rows={kind === "texto" ? 5 : 2} maxLength={2000} defaultValue={initial.content} />
      </Field>

      {kind !== "video" ? (
        <>
          <ImageField
            name="media"
            label={kind === "print" ? "Imagem do print" : "Foto do cliente"}
            hint={kind === "print" ? "Se houver dados pessoais na conversa (telefones, sobrenomes), corte ou cubra antes de enviar." : "Opcional. Só envie com autorização do cliente."}
            defaultValue={media}
            aspect={kind === "print" ? "4/5" : "1/1"}
          />
          <Field
            name="mediaAlt"
            label={kind === "print" ? "O que o print diz" : "Descrição da foto"}
            required={kind === "print"}
            optional={kind !== "print"}
            hint={kind === "print" ? "Descreva a conversa em uma ou duas frases, para quem usa leitor de tela." : "Ex.: Retrato de Ana sorrindo no estúdio."}
          >
            <Textarea rows={2} maxLength={300} defaultValue={initial.mediaAlt} />
          </Field>
        </>
      ) : (
        <Field name="videoUrl" label="Link do vídeo" required hint="YouTube ou Vimeo.">
          <Input type="url" inputMode="url" autoCapitalize="none" maxLength={300} defaultValue={initial.videoUrl} placeholder="https://youtu.be/…" />
        </Field>
      )}

      <div className="space-y-1">
        <Switch name="authorized" label="Autorização do cliente registrada" hint="Marque só se o cliente autorizou mostrar nome, imagem e texto no site. É obrigatório para publicar." defaultChecked={initial.authorized} />
        <Switch name="published" label="Publicado no site" hint="Desligado, o depoimento fica como rascunho e não aparece para os visitantes." defaultChecked={initial.published} />
      </div>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{initial.id === null ? "Criar depoimento" : "Salvar depoimento"}</SubmitButton>
        <ButtonLink href="/painel/site/depoimentos" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
