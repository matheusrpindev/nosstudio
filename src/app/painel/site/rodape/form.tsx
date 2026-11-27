"use client";

/**
 * Formulário de Editar site › Rodapé: liga/desliga a experiência e cadastra as fotos da câmera (imagens com texto
 * alternativo) e os trechos do celular (vídeos curtos, sem som). Nada vai para o site antes de salvar.
 */
import { ActionForm, Field, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { GalleryField, VideoField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { FOOTER_CLIP_CAPTION_MAX, FOOTER_CLIPS_MAX, FOOTER_PHOTOS_MAX } from "@/lib/site/footer-experience";

export type FooterExperienceFormValues = {
  enabled: boolean;
  photos: MediaValue[];
  clips: { media: MediaValue | null; caption: string }[];
};

export function FooterExperienceForm({ action, initial, canEdit }: { action: FormAction; initial: FooterExperienceFormValues; canEdit: boolean }) {
  const slots = Array.from({ length: FOOTER_CLIPS_MAX }, (_, index) => initial.clips[index] ?? { media: null, caption: "" });
  return (
    <ActionForm action={action} className="space-y-8">
      <section aria-labelledby="rodape-exibicao" className="card card-pad space-y-2">
        <h2 id="rodape-exibicao" className="text-texto text-base font-bold">
          Exibição
        </h2>
        <Switch
          name="enabled"
          label="Mostrar o rodapé interativo no site"
          hint="Aparece no fim de todas as páginas, logo acima do rodapé. Desligado, o espaço volta a mostrar só o contador de visitas (se ele estiver ligado)."
          defaultChecked={initial.enabled}
          disabled={!canEdit}
        />
      </section>

      <section aria-labelledby="rodape-fotos" className="card card-pad space-y-3">
        <div>
          <h2 id="rodape-fotos" className="text-texto text-base font-bold">
            Fotos da câmera
          </h2>
          <p className="text-texto-suave mt-1 text-sm leading-relaxed">
            A cada clique na câmera, a próxima foto da lista é “revelada” na fotografia instantânea. Sem fotos, a câmera revela uma composição gráfica da
            marca. Use só fotos de trabalhos reais e autorizados.
          </p>
        </div>
        <GalleryField
          name="photos"
          label={`Fotos (até ${FOOTER_PHOTOS_MAX})`}
          max={FOOTER_PHOTOS_MAX}
          defaultValue={initial.photos}
          hint="Prefira fotos quadradas ou verticais. Toda foto precisa de texto alternativo: é o que leitores de tela anunciam quando ela aparece."
        />
      </section>

      <section aria-labelledby="rodape-trechos" className="card card-pad space-y-4">
        <div>
          <h2 id="rodape-trechos" className="text-texto text-base font-bold">
            Trechos do celular
          </h2>
          <p className="text-texto-suave mt-1 text-sm leading-relaxed">
            Durante o REC, a tela do celular passa os trechos na ordem, sem som. Vídeos curtos (alguns segundos), na vertical de preferência, MP4 ou WebM até
            30 MB. Sem trechos, a tela mostra uma composição animada da marca.
          </p>
        </div>
        <ol className="grid gap-6">
          {slots.map((slot, index) => (
            <li key={index} className="border-borda grid gap-3 border-t pt-4 first:border-t-0 first:pt-0">
              <VideoField name={`clip${index}`} label={`Trecho ${index + 1}`} defaultValue={slot.media} />
              <Field name={`clipCaption${index}`} label={`Legenda do trecho ${index + 1}`} optional hint="Uma linha que aparece na tela do celular durante o trecho (ex.: o nome do projeto).">
                <Input maxLength={FOOTER_CLIP_CAPTION_MAX} autoComplete="off" defaultValue={slot.caption} />
              </Field>
            </li>
          ))}
        </ol>
      </section>

      {canEdit ? (
        <FormActions>
          <SubmitButton pendingLabel="Salvando…">Salvar rodapé</SubmitButton>
        </FormActions>
      ) : null}
    </ActionForm>
  );
}
