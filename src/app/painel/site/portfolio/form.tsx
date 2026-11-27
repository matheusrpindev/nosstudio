import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { DateInput, Input, Select, Textarea } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import { MarkdownField } from "@/components/ui/markdown-field";
import { GalleryField, ImageField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import type { PortfolioProject } from "@/db/schema";
import { PORTFOLIO_CATEGORY_LABELS } from "@/lib/domain";
import type { RelatedOption } from "@/server/site/admin/portfolio";
import { BeforeAfterField, OriginField, RelatedField, type BeforeAfterDefault } from "./fields";
import { PORTFOLIO_LIMITS } from "./limits";

export type PortfolioFormMedia = {
  cover: MediaValue | null;
  gallery: MediaValue[];
  backstage: MediaValue[];
  beforeAfter: BeforeAfterDefault[];
};

export const EMPTY_PORTFOLIO_MEDIA: PortfolioFormMedia = { cover: null, gallery: [], backstage: [], beforeAfter: [] };

/** Uma seção do formulário: cartão com título, explicação e os campos. */
function FormSection({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card flush as="section" aria-labelledby={`secao-${id}`}>
      <CardHeader id={`secao-${id}`} title={title} description={description} />
      <CardSection className="space-y-5">{children}</CardSection>
    </Card>
  );
}

const CASE_HINT = "Aceita negrito, listas e links. Em branco, o bloco não aparece no site.";

/**
 * Formulário de projeto do portfólio, em seções: básico, estudo de caso, mídia, antes e depois, bastidores,
 * relacionados e publicação. `project` nulo = novo. Validação: schema.ts; regras de publicação: actions.ts.
 */
export function PortfolioForm({
  action,
  project,
  media,
  related,
}: {
  action: FormAction;
  project: PortfolioProject | null;
  media: PortfolioFormMedia;
  /** Os outros projetos, para a seção "relacionados". */
  related: RelatedOption[];
}) {
  return (
    <ActionForm action={action} hidden={{ id: project?.id }}>
      <FormSection id="basico" title="Básico" description="O que identifica o projeto no cartão e no topo da página dele.">
        <Field name="title" label="Título do projeto" required>
          <Input maxLength={140} autoComplete="off" defaultValue={project?.title} />
        </Field>
        <FieldRow>
          <Field name="category" label="Categoria" required hint="É por ela que o visitante filtra o portfólio.">
            <Select options={PORTFOLIO_CATEGORY_LABELS} placeholder="Selecione…" defaultValue={project?.category} />
          </Field>
          <Field name="projectDate" label="Data do trabalho" optional hint="O site mostra o mês e o ano.">
            <DateInput defaultValue={project?.projectDate ?? ""} />
          </Field>
        </FieldRow>
        <Field name="clientName" label="Cliente" optional hint="Fica guardado aqui; só aparece no site se você marcar a opção abaixo.">
          <Input maxLength={120} autoComplete="off" defaultValue={project?.clientName} />
        </Field>
        <Switch
          name="showClient"
          label="Exibir o nome do cliente no site (autorizado)"
          hint="Marque só se o cliente autorizou aparecer com o nome. Sem isso, o projeto é mostrado sem identificação — e o nome não vai para o site de jeito nenhum."
          defaultChecked={project?.showClient ?? false}
        />
        <Field name="summary" label="Resumo" optional hint="Uma ou duas frases, mostradas no cartão e na abertura da página do projeto.">
          <Textarea rows={2} maxLength={300} defaultValue={project?.summary} />
        </Field>
        <MarkdownField name="description" label="Descrição" optional rows={6} maxLength={8000} defaultValue={project?.description} hint="Apresentação geral do trabalho. Aceita negrito, listas e links." />
        <StringListField
          name="servicesDone"
          label="Serviços realizados"
          defaultValue={project?.servicesDone ?? []}
          placeholder="Ex.: Fotografia de produto"
          addLabel="Adicionar serviço"
          max={PORTFOLIO_LIMITS.services}
          maxLength={120}
          emptyLabel="Nenhum serviço listado ainda."
          hint="Também entram na pesquisa do portfólio."
        />
      </FormSection>

      <FormSection
        id="estudo"
        title="Estudo de caso"
        description="Objetivo, desafio, solução e resultados. Preencha só o que fizer sentido: cada bloco aparece no site apenas quando tem texto."
      >
        <MarkdownField name="objective" label="Objetivo" optional rows={4} maxLength={PORTFOLIO_LIMITS.caseText} defaultValue={project?.objective} hint={`O que o cliente queria alcançar. ${CASE_HINT}`} />
        <MarkdownField name="challenge" label="Desafio" optional rows={4} maxLength={PORTFOLIO_LIMITS.caseText} defaultValue={project?.challenge} hint={`O que tornava o trabalho difícil. ${CASE_HINT}`} />
        <MarkdownField name="solution" label="Solução" optional rows={4} maxLength={PORTFOLIO_LIMITS.caseText} defaultValue={project?.solution} hint={`O que foi feito. ${CASE_HINT}`} />
        <MarkdownField
          name="results"
          label="Resultados"
          optional
          rows={4}
          maxLength={PORTFOLIO_LIMITS.caseText}
          defaultValue={project?.results}
          hint="Só resultados comprovados, que você possa demonstrar se alguém perguntar (números, depoimento, alcance). Sem resultado comprovado, deixe em branco."
        />
      </FormSection>

      <FormSection id="midia" title="Mídia" description="Capa, galeria e vídeos. Toda imagem precisa de texto alternativo para o projeto poder ser publicado.">
        <ImageField name="cover" label="Capa" hint="Obrigatória para publicar. Imagem real do projeto, que o cliente autorizou mostrar." defaultValue={media.cover} aspect="4/3" />
        <GalleryField name="gallery" label="Galeria" hint="Fotos reais, na ordem em que aparecem. No site, cada uma abre ampliada." defaultValue={media.gallery} max={PORTFOLIO_LIMITS.gallery} />
        <Field name="videoUrl" label="Vídeo principal" optional hint="Link do YouTube ou do Vimeo. O vídeo só carrega quando o visitante clica.">
          <Input type="url" inputMode="url" autoCapitalize="none" maxLength={300} defaultValue={project?.videoUrl ?? ""} placeholder="https://youtu.be/…" />
        </Field>
        <StringListField
          name="extraVideoUrls"
          label="Vídeos adicionais"
          defaultValue={project?.extraVideoUrls ?? []}
          placeholder="https://youtu.be/… ou https://vimeo.com/…"
          addLabel="Adicionar vídeo"
          max={PORTFOLIO_LIMITS.extraVideos}
          maxLength={300}
          emptyLabel="Nenhum vídeo adicional."
          hint="Um link do YouTube ou do Vimeo por linha. Aparecem depois do vídeo principal."
        />
      </FormSection>

      <FormSection id="antes-depois" title="Antes e depois" description="Para mostrar uma transformação: a mesma cena antes e depois do trabalho.">
        <BeforeAfterField defaultValue={media.beforeAfter} />
      </FormSection>

      <FormSection id="bastidores" title="Bastidores" description="Fotos do processo: gravação, montagem, equipe em ação. Sem nenhuma, o bloco não aparece.">
        <GalleryField
          name="backstage"
          label="Fotos de bastidores"
          hint="Só imagens com autorização de quem aparece nelas."
          defaultValue={media.backstage}
          max={PORTFOLIO_LIMITS.backstage}
        />
      </FormSection>

      <FormSection id="relacionados" title="Relacionados" description="Outros trabalhos para o visitante continuar navegando.">
        <RelatedField options={related} defaultValue={project?.relatedProjectIds ?? []} />
      </FormSection>

      <FormSection id="publicacao" title="Publicação" description="Publicar é sempre uma decisão sua: nada do painel vai para o portfólio sozinho.">
        <OriginField defaultOrigin={project?.origin ?? "nos"} defaultNote={project?.originNote ?? ""} />
        <div className="space-y-1">
          <Switch
            name="featured"
            label="Destaque"
            hint="Projetos em destaque aparecem maiores no portfólio e entram no bloco de portfólio da página inicial, na ordem da lista."
            defaultChecked={project?.featured ?? false}
          />
          <Switch
            name="published"
            label="Publicado no site"
            hint="Só publica com capa e com texto alternativo em todas as imagens. Desligado, o projeto fica como rascunho e não aparece para os visitantes (nem as imagens dele)."
            defaultChecked={project?.published ?? false}
          />
        </div>
        <details className="border-borda rounded-campo border px-4 py-3">
          <summary className="text-texto min-h-11 cursor-pointer py-2.5 text-sm font-semibold">Avançado</summary>
          <div className="pt-2 pb-1">
            <Field name="slug" label="Endereço do projeto" optional hint="É o final do link: /portfolio/endereco. Deixe em branco para gerar a partir do título.">
              <Input maxLength={80} autoCapitalize="none" autoComplete="off" defaultValue={project?.slug} placeholder="gerado automaticamente" />
            </Field>
          </div>
        </details>
      </FormSection>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{project ? "Salvar projeto" : "Criar projeto"}</SubmitButton>
        <ButtonLink href="/painel/site/portfolio" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
