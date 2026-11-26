"use client";

import { CheckCircle2 } from "lucide-react";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BRAND_COLOR_HEX, BRAND_COLOR_LABELS, BRAND_COLORS, type BrandColor } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { contrastRatio, MIN_CONTRAST } from "./contrast";
import { AnnouncementPreview } from "./preview";

export type AnnouncementFormValues = {
  id: number | null;
  message: string;
  linkLabel: string;
  linkUrl: string;
  bgColor: BrandColor;
  textColor: BrandColor;
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
  enabled: boolean;
};

/** Amostras da paleta como botões de rádio (setas funcionam; o escolhido tem anel e marca de seleção). */
function ColorSwatches({ name, label, value, onChange }: { name: string; label: string; value: BrandColor; onChange: (color: BrandColor) => void }) {
  const legendId = useId();
  return (
    <fieldset className="min-w-0">
      <legend id={legendId} className="label">
        {label}
      </legend>
      <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {BRAND_COLORS.map((color) => {
          const selected = value === color;
          return (
            <label
              key={color}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-campo border-2 px-1 py-2 text-xs font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-foco/30",
                selected ? "border-detalhe bg-detalhe-suave" : "border-borda hover:border-borda-forte bg-superficie",
              )}
            >
              <input type="radio" name={name} value={color} checked={selected} onChange={() => onChange(color)} data-controlled="" className="sr-only" />
              <span aria-hidden="true" className="border-borda-forte size-7 rounded-full border" style={{ backgroundColor: BRAND_COLOR_HEX[color] }} />
              {BRAND_COLOR_LABELS[color]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AnnouncementForm({ action, initial }: { action: FormAction; initial: AnnouncementFormValues }) {
  const [message, setMessage] = useState(initial.message);
  const [linkLabel, setLinkLabel] = useState(initial.linkLabel);
  const [bg, setBg] = useState<BrandColor>(initial.bgColor);
  const [fg, setFg] = useState<BrandColor>(initial.textColor);
  const [dismissible, setDismissible] = useState(initial.dismissible);

  const ratio = contrastRatio(BRAND_COLOR_HEX[bg], BRAND_COLOR_HEX[fg]);
  const low = ratio < MIN_CONTRAST;
  const ratioText = ratio.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <ActionForm action={action} hidden={{ id: initial.id }}>
      <Field name="message" label="Mensagem" required hint="Frase curta: aparece no topo de todas as páginas do site.">
        <Textarea rows={2} maxLength={240} defaultValue={initial.message} onChange={(event) => setMessage(event.target.value)} />
      </Field>

      <FieldRow>
        <Field name="linkLabel" label="Texto do botão ou link" optional hint="Ex.: Saiba mais">
          <Input maxLength={40} autoComplete="off" defaultValue={initial.linkLabel} onChange={(event) => setLinkLabel(event.target.value)} />
        </Field>
        <Field name="linkUrl" label="Para onde leva" optional hint="Um caminho do site (/contato) ou um link completo (https://…).">
          <Input maxLength={500} inputMode="url" autoCapitalize="none" autoComplete="off" defaultValue={initial.linkUrl} />
        </Field>
      </FieldRow>

      <div className="space-y-4">
        <ColorSwatches name="bgColor" label="Cor de fundo" value={bg} onChange={setBg} />
        <ColorSwatches name="textColor" label="Cor do texto" value={fg} onChange={setFg} />
      </div>

      <div className="space-y-3" aria-live="polite">
        <p className="label">Prévia ao vivo</p>
        <AnnouncementPreview message={message} linkLabel={linkLabel} bg={BRAND_COLOR_HEX[bg]} fg={BRAND_COLOR_HEX[fg]} dismissible={dismissible} />
        {low ? (
          <Alert tone="alerta" title={`Contraste baixo (${ratioText}:1)`}>
            Com estas cores o texto fica difícil de ler, principalmente no celular. O recomendado é pelo menos {MIN_CONTRAST.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}:1. Tente um fundo escuro com texto claro, ou o contrário.
          </Alert>
        ) : (
          <p className="text-sucesso flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle2 aria-hidden="true" className="size-4" /> Contraste bom ({ratioText}:1).
          </p>
        )}
      </div>

      <FieldRow>
        <Field name="startsAt" label="Começa em" optional hint="Vazio = aparece assim que for ligado. Horário do estúdio.">
          <Input type="datetime-local" defaultValue={initial.startsAt} />
        </Field>
        <Field name="endsAt" label="Termina em" optional hint="Vazio = fica no ar até você desligar.">
          <Input type="datetime-local" defaultValue={initial.endsAt} />
        </Field>
      </FieldRow>

      <div className="space-y-1">
        <Switch name="dismissible" label="O visitante pode fechar o aviso" hint="Mostra um “×”. Quem fecha não vê o aviso de novo, a menos que você edite o texto." defaultChecked={initial.dismissible} onCheckedChange={setDismissible} />
        <Switch name="enabled" label="Aviso ligado" hint="Desligado, ele fica guardado aqui e não aparece no site." defaultChecked={initial.enabled} />
      </div>

      <Alert tone="info">
        O site mostra <strong>um aviso por vez</strong>: o primeiro da lista que estiver ligado e dentro do período. Use as setas da lista para decidir qual vem primeiro.
      </Alert>

      <FormActions>
        <SubmitButton pendingLabel="Salvando…">{initial.id === null ? "Criar aviso" : "Salvar aviso"}</SubmitButton>
        <ButtonLink href="/painel/site/avisos" variant="ghost">
          Cancelar
        </ButtonLink>
      </FormActions>
    </ActionForm>
  );
}
