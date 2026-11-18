import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionForm, Field, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FileField } from "@/components/ui/media-fields";
import { BRAND_ASSET_CATEGORY_LABELS, type BrandAssetCategory } from "@/lib/domain";
import type { MediaValue } from "@/server/media";

/** Formulário de item da biblioteca da marca (adicionar e editar). */
export function AssetForm({
  action,
  asset,
  file,
  defaultCategory,
  submitLabel,
}: {
  action: FormAction;
  asset?: { id: number; category: BrandAssetCategory; title: string; description: string; url: string };
  file: MediaValue | null;
  defaultCategory?: BrandAssetCategory;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} hidden={asset ? { id: asset.id } : undefined}>
      <Card className="space-y-5">
        <Field name="title" label="Título" hint="Ex.: Apresentação institucional 2026" required>
          <Input autoComplete="off" maxLength={120} defaultValue={asset?.title} />
        </Field>
        <Field name="category" label="Categoria" required>
          <Select options={BRAND_ASSET_CATEGORY_LABELS} defaultValue={asset?.category ?? defaultCategory ?? "outro"} />
        </Field>
        <Field name="description" label="Descrição" hint="Para que serve, versão, onde usar." optional>
          <Textarea rows={3} maxLength={500} defaultValue={asset?.description} />
        </Field>
        <Field name="url" label="Link externo" hint="Pasta do Drive, arquivo do Canva, página da fonte… Opcional." optional>
          <Input inputMode="url" autoComplete="off" autoCapitalize="none" maxLength={500} placeholder="https://" defaultValue={asset?.url} />
        </Field>
        <FileField name="mediaId" label="Arquivo" hint="Opcional. Fica privado: só abre com login no painel." defaultValue={file} />
        <FormActions>
          <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
          <ButtonLink href="/painel/marca" variant="ghost">
            Cancelar
          </ButtonLink>
        </FormActions>
      </Card>
    </ActionForm>
  );
}
