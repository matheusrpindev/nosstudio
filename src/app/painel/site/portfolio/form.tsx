import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import { MarkdownField } from "@/components/ui/markdown-field";
import { GalleryField, ImageField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import type { PortfolioProject } from "@/db/schema";

/** Formulário de projeto do portfólio. `project` nulo = novo. */
export function PortfolioForm({ action, project, cover, gallery }: { action: FormAction; project: PortfolioProject | null; cover: MediaValue | null; gallery: MediaValue[] }) {
  return (
    <ActionForm action={action} hidden={{ id: project?.id }}>
      <Field name="title" label="Título do projeto" required>
        <Input maxLength={140} autoComplete="off" defaultValue={project?.title} />
      </Field>
      <FieldRow>
        <Field name="category" label="Categoria" required>
          <Select options={PORTFOLIO_CATEGORY_LABELS} placeholder="Selecione…" defaultValue={project?.category} />
        </Field>
        <Field name="projectDate" label="Data do trabalho" optional hint="Mês e ano em que foi feito.">
          <DateInput defaultValue={project?.projectDate ?? ""} />
        </Field>
      </FieldRow>

      <Field name="clientName" label="Cliente" optional hint="Fica guardado aqui; só aparece no site se você marcar a opção abaixo.">
        <Input maxLength={120} autoComplete="off" defaultValue={project?.clientName} />
      </Field>
      <Switch name="showClient" label="Exibir o nome do cliente no site (autorizado)" hint="Marque só se o cliente autorizou aparecer com o nome. Sem isso, o projeto é mostrado sem identificação." defaultChecked={project?.showClient ?? false} />

      <Field name="summary" label="Resumo" optional hint="Uma ou duas frases, mostradas no cartão do projeto.">
        <Textarea rows={2} maxLength={300} defaultValue={project?.summary} />
      </Field>
      <MarkdownField name="description" label="Descrição" optional rows={8} maxLength={8000} defaultValue={project?.description} hint="Como foi o trabalho, o que a NÓS entregou. Aceita negrito, listas e links." />
      <StringListField name="servicesDone" label="Serviços realizados" defaultValue={project?.servicesDone ?? []} placeholder="Ex.: Fotografia de produto" addLabel="Adicionar serviço" max={20} maxLength={120} emptyLabel="Nenhum serviço listado ainda." />

      <ImageField name="cover" label="Capa" hint="Imagem real do projeto, que o cliente autorizou mostrar." defaultValue={cover} aspect="4/3" />
      <GalleryField name="gallery" label="Galeria" hint="Fotos reais, na ordem em que aparecem." defaultValue={gallery} max={40} />
      <Field name="videoUrl" label="Vídeo" optional hint="Link do YouTube ou do Vimeo.">
        <Input type="url" inputMode="url" autoCapitalize="none" maxLength={300} defaultValue={project?.videoUrl ?? ""} placeholder="https://youtu.be/…" />
      </Field>

      <div className="space-y-1">
        <Switch name="featured" label="Destaque" hint="Projetos em destaque aparecem primeiro e na página inicial." defaultChecked={project?.featured ?? false} />
        <Switch name="published" label="Publicado no site" hint="Desligado, o projeto fica como rascunho e não aparece para os visitantes." defaultChecked={project?.published ?? false} />
      </div>

      <details className="border-borda rounded-campo border px-4 py-3">
        <summary className="text-texto min-h-11 cursor-pointer py-2.5 text-sm font-semibold">Avançado</summary>
        <div className="pt-2 pb-1">
          <Field name="slug" label="Endereço do projeto" optional hint="Deixe em branco para gerar a partir do título.">
            <Input maxLength={80} autoCapitalize="none" autoComplete="off" defaultValue={project?.slug} placeholder="gerado automaticamente" />
          </Field>
        </div>
      </details>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{project ? "Salvar projeto" : "Criar projeto"}</SubmitButton>
        <ButtonLink href="/painel/site/portfolio" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
