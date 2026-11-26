import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { ButtonLink } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import { MarkdownField } from "@/components/ui/markdown-field";
import { GalleryField, ImageField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { SERVICE_INTEREST_LABELS } from "@/lib/domain";
import type { Service } from "@/db/schema";

/** Formulário de serviço (Server Component; os campos do kit é que são de cliente). `service` nulo = novo. */
export function ServiceForm({ action, service, cover, gallery }: { action: FormAction; service: Service | null; cover: MediaValue | null; gallery: MediaValue[] }) {
  return (
    <ActionForm action={action} hidden={{ id: service?.id }}>
      <Field name="title" label="Nome do serviço" required>
        <Input maxLength={120} autoComplete="off" defaultValue={service?.title} />
      </Field>
      <Field name="summary" label="Resumo" optional hint="Uma ou duas frases, mostradas no cartão do serviço.">
        <Textarea rows={2} maxLength={240} defaultValue={service?.summary} />
      </Field>
      <MarkdownField name="description" label="Descrição" optional rows={8} maxLength={8000} defaultValue={service?.description} hint="Texto completo do serviço. Aceita negrito, listas e links." />
      <StringListField name="items" label="O que está incluído" defaultValue={service?.items ?? []} placeholder="Ex.: Roteiro e planejamento" addLabel="Adicionar item" max={30} maxLength={160} emptyLabel="Nenhum item ainda. Itens aparecem como lista no site." />

      <FieldRow>
        <Field name="ctaLabel" label="Texto do botão" required>
          <Input maxLength={40} defaultValue={service?.ctaLabel ?? "Solicitar orçamento"} />
        </Field>
        <Field name="interest" label="Interesse já marcado no formulário" required hint="Quem clicar no botão chega ao contato com este serviço selecionado.">
          <Select options={SERVICE_INTEREST_LABELS} defaultValue={service?.interest ?? "outro"} />
        </Field>
      </FieldRow>

      <ImageField name="cover" label="Capa" hint="Imagem real do serviço. Sem capa, o site usa um desenho da marca." defaultValue={cover} aspect="16/10" />
      <GalleryField name="gallery" label="Galeria" hint="Fotos reais, na ordem em que aparecem." defaultValue={gallery} max={24} />

      <Field name="videoUrl" label="Vídeo" optional hint="Link do YouTube ou do Vimeo.">
        <Input type="url" inputMode="url" autoCapitalize="none" maxLength={300} defaultValue={service?.videoUrl ?? ""} placeholder="https://youtu.be/…" />
      </Field>

      <Switch name="visible" label="Mostrar no site" hint="Desligado, o serviço fica guardado e não aparece para os visitantes." defaultChecked={service?.visible ?? true} />

      <details className="border-borda rounded-campo border px-4 py-3">
        <summary className="text-texto min-h-11 cursor-pointer py-2.5 text-sm font-semibold">Avançado</summary>
        <div className="space-y-5 pt-2 pb-1">
          <Field name="slug" label="Endereço do serviço" optional hint="Deixe em branco para gerar a partir do nome. Se o nome mudar, o endereço antigo continua o mesmo.">
            <Input maxLength={80} autoCapitalize="none" autoComplete="off" defaultValue={service?.slug} placeholder="gerado automaticamente" />
          </Field>
          <Field name="pagePath" label="Página própria" optional hint="Só para serviços que têm uma página só deles, como Casamentos (/casamentos). Nos demais, deixe vazio.">
            <Input maxLength={80} autoCapitalize="none" autoComplete="off" defaultValue={service?.pagePath ?? ""} placeholder="/casamentos" />
          </Field>
        </div>
      </details>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{service ? "Salvar serviço" : "Criar serviço"}</SubmitButton>
        <ButtonLink href="/painel/site/servicos" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
