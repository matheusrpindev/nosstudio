"use client";

/**
 * Formulário de um banner do carrossel, com a prévia ao vivo (computador e celular) e os avisos do que falta.
 * A prévia usa o que está digitado AGORA — nada vai para o site antes de salvar com o banner ligado.
 */
import { CheckCircle2, Monitor, Smartphone } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton, type FormAction } from "@/components/ui/form";
import { Input, RadioCards, Textarea } from "@/components/ui/input";
import { ImageField, VideoField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { BANNER_LAYOUT_LABELS, BANNER_LAYOUTS, BANNER_TONE_LABELS, BANNER_TONES, BRAND_COLOR_HEX, BRAND_COLOR_LABELS, BRAND_COLORS, type BannerLayout, type BannerTone, type BrandColor } from "@/lib/domain";
import type { PublicImage } from "@/lib/media";
import { BANNER_DURATION, BANNER_SIZES, bannerWarnings, resolveBannerHref, type BannerLink, type BannerView, type BannerViewport, type SiteAvailability } from "@/lib/site/banners";
import { BannerPreview } from "./preview";

export type BannerFormValues = {
  id: number | null;
  name: string;
  layout: BannerLayout;
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  desktop: MediaValue | null;
  mobile: MediaValue | null;
  video: MediaValue | null;
  alt: string;
  bgColor: BrandColor;
  tone: BannerTone;
  durationSeconds: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
};

const LAYOUT_HELP: Record<BannerLayout, string> = {
  tipografico: "Título grande sobre uma cor da marca, com um dos símbolos do logo. Não precisa de foto.",
  midia: "Uma foto ou um vídeo curto ao fundo, com título, subtítulo e botões por cima.",
  peca: "Uma arte que já vem pronta (com os textos dentro). Ela ocupa o banner inteiro e vira um link.",
};

const COLOR_MOTIF: Record<BrandColor, string> = {
  roxo: "visor + o Ó do logo",
  grafite: "o play",
  preto: "o play",
  lima: "o acento",
  lavanda: "os anéis",
  offwhite: "papel com campo roxo",
  branco: "papel com campo roxo",
};

/** Mídia do campo de upload → imagem pronta para o componente do site. */
function toImage(media: MediaValue | null): PublicImage | null {
  if (!media || !media.mime.startsWith("image/") || !media.width || !media.height) return null;
  return { id: media.id, url: media.url, width: media.width, height: media.height, alt: media.alt, sources: [], placeholderColor: null };
}

function ColorSwatches({ name, label, hint, value, onChange }: { name: string; label: string; hint?: ReactNode; value: BrandColor; onChange: (color: BrandColor) => void }) {
  const legendId = useId();
  return (
    <fieldset className="min-w-0">
      <legend id={legendId} className="label">
        {label}
      </legend>
      <div className="mt-1 grid grid-cols-4 gap-2 sm:grid-cols-7">
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
      {hint ? <p className="hint">{hint}</p> : null}
    </fieldset>
  );
}

export function BannerForm({
  action,
  initial,
  now,
  site,
  eyebrow,
  symbol,
}: {
  action: FormAction;
  initial: BannerFormValues;
  /** Horário do estúdio agora (`YYYY-MM-DDTHH:mm`), para os avisos de período. */
  now: string;
  /** O que está no ar no site (para avisar de botão que aponta para página oculta). */
  site: SiteAvailability;
  eyebrow: string;
  /** O Ó do logo (Server Component), repassado às prévias. */
  symbol: ReactNode;
}) {
  const [layout, setLayout] = useState<BannerLayout>(initial.layout);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [buttonLabel, setButtonLabel] = useState(initial.buttonLabel);
  const [buttonUrl, setButtonUrl] = useState(initial.buttonUrl);
  const [secondaryLabel, setSecondaryLabel] = useState(initial.secondaryLabel);
  const [secondaryUrl, setSecondaryUrl] = useState(initial.secondaryUrl);
  const [desktop, setDesktop] = useState<MediaValue | null>(initial.desktop);
  const [mobile, setMobile] = useState<MediaValue | null>(initial.mobile);
  const [video, setVideo] = useState<MediaValue | null>(initial.video);
  const [alt, setAlt] = useState(initial.alt);
  const [bgColor, setBgColor] = useState<BrandColor>(initial.bgColor);
  const [tone, setTone] = useState<BannerTone>(initial.tone);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [view, setView] = useState<BannerViewport>("desktop");

  const usesMedia = layout !== "tipografico";
  const link = (label: string, url: string, allowBare = false): BannerLink | null => {
    const href = resolveBannerHref(url, site).href;
    return href && (label.trim() || allowBare) ? { label: label.trim(), href } : null;
  };
  const preview: BannerView = {
    id: initial.id ?? 0,
    layout,
    title,
    subtitle,
    primary: link(buttonLabel, buttonUrl, layout === "peca"),
    secondary: link(secondaryLabel, secondaryUrl),
    desktop: toImage(desktop),
    mobile: toImage(mobile),
    video: layout === "midia" && video ? { id: video.id, url: video.url, mime: video.mime } : null,
    alt,
    bgColor,
    tone,
    durationSeconds: initial.durationSeconds,
    endsAt: null,
  };
  const warnings = bannerWarnings(
    { layout, title, alt, buttonLabel, buttonUrl, secondaryLabel, secondaryUrl, desktop, mobile, hasVideo: Boolean(video), enabled, startsAt: startsAt || null, endsAt: endsAt || null },
    now,
    site,
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] xl:items-start">
      <ActionForm action={action} hidden={{ id: initial.id }} className="card space-y-5 p-4 sm:p-6">
        <Field name="name" label="Nome interno" optional hint="Só aparece aqui no painel, para você achar o banner na lista. Vazio = usa o título.">
          <Input maxLength={120} autoComplete="off" defaultValue={initial.name} />
        </Field>

        <fieldset className="min-w-0">
          <legend className="label">Tipo de banner</legend>
          <RadioCards
            name="layout"
            cols={1}
            value={layout}
            onValueChange={(value) => setLayout(value as BannerLayout)}
            options={BANNER_LAYOUTS.map((value) => ({ value, label: BANNER_LAYOUT_LABELS[value], description: LAYOUT_HELP[value] }))}
          />
        </fieldset>

        <Field
          name="title"
          label="Título"
          optional={layout !== "tipografico"}
          required={layout === "tipografico"}
          hint={
            layout === "peca"
              ? "Não aparece na arte: fica para leitores de tela e buscadores."
              : "Frase curta. Com vírgula ou ponto no meio, quebra em duas linhas e a segunda ganha a cor de destaque."
          }
        >
          <Input maxLength={120} autoComplete="off" defaultValue={initial.title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field name="subtitle" label="Subtítulo" optional hint={layout === "peca" ? "Também só para leitores de tela e buscadores." : "Uma linha de apoio abaixo do título."}>
          <Textarea rows={2} maxLength={200} defaultValue={initial.subtitle} onChange={(event) => setSubtitle(event.target.value)} />
        </Field>

        <FieldRow>
          <Field name="buttonLabel" label="Botão principal" optional hint={layout === "peca" ? "Em peça pronta o botão não aparece: o banner inteiro é o link." : "Ex.: Conheça a NÓS"}>
            <Input maxLength={60} autoComplete="off" defaultValue={initial.buttonLabel} onChange={(event) => setButtonLabel(event.target.value)} />
          </Field>
          <Field name="buttonUrl" label="Para onde leva" optional hint="Um caminho do site (/sobre) ou um link completo (https://…).">
            <Input maxLength={500} inputMode="url" autoCapitalize="none" autoComplete="off" defaultValue={initial.buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} />
          </Field>
        </FieldRow>
        <div hidden={layout === "peca"}>
          <FieldRow>
            <Field name="secondaryLabel" label="Segundo botão" optional hint="De contorno, ao lado do principal.">
              <Input maxLength={60} autoComplete="off" defaultValue={initial.secondaryLabel} onChange={(event) => setSecondaryLabel(event.target.value)} />
            </Field>
            <Field name="secondaryUrl" label="Para onde leva" optional>
              <Input maxLength={500} inputMode="url" autoCapitalize="none" autoComplete="off" defaultValue={initial.secondaryUrl} onChange={(event) => setSecondaryUrl(event.target.value)} />
            </Field>
          </FieldRow>
        </div>

        {/* Os campos de mídia continuam montados quando o tipo é "só texto" (guardam o que já foi enviado). */}
        <div hidden={!usesMedia} className="space-y-5">
          <ImageField
            name="desktopMediaId"
            label={layout === "midia" ? "Imagem — computador" : "Arte — computador"}
            aspect="12/5"
            altField={false}
            defaultValue={initial.desktop}
            onChange={setDesktop}
            hint={`Sugestão: ${BANNER_SIZES.desktop.label} (deitada).${layout === "midia" ? " Com vídeo, serve de capa." : ""}`}
          />
          <ImageField
            name="mobileMediaId"
            label={layout === "midia" ? "Imagem — celular" : "Arte — celular"}
            aspect="4/5"
            altField={false}
            defaultValue={initial.mobile}
            onChange={setMobile}
            hint={`Sugestão: ${BANNER_SIZES.mobile.label} (em pé). Sem ela, o celular usa a de computador.`}
          />
          <div hidden={layout !== "midia"}>
            <VideoField
              name="videoMediaId"
              label="Vídeo de fundo"
              defaultValue={initial.video}
              onChange={setVideo}
              hint="Opcional. Curto (até uns 15 segundos), sem som e em repetição. Só carrega quando o banner está em tela; quem pediu menos movimento ou economia de dados vê a imagem."
            />
          </div>
          <Field
            name="alt"
            label="Texto alternativo (descrição da imagem)"
            optional={layout !== "peca"}
            required={layout === "peca"}
            hint={
              layout === "peca"
                ? "Escreva o que está na arte, incluindo os textos dela. É o que leitores de tela e buscadores recebem."
                : "Descreva a imagem em uma frase. Deixe vazio se ela for só um fundo decorativo."
            }
          >
            <Textarea rows={2} maxLength={300} defaultValue={initial.alt} onChange={(event) => setAlt(event.target.value)} />
          </Field>
        </div>

        <div hidden={layout === "midia"}>
          <ColorSwatches
            name="bgColor"
            label="Cor de fundo"
            value={bgColor}
            onChange={setBgColor}
            hint={layout === "peca" ? "Aparece atrás da arte enquanto ela carrega e nas sobras, se a proporção for diferente da sugerida." : `Cada cor traz uma composição da marca. ${BRAND_COLOR_LABELS[bgColor]}: ${COLOR_MOTIF[bgColor]}.`}
          />
        </div>
        <fieldset className="min-w-0" hidden={layout !== "midia"}>
          <legend className="label">Cor do texto sobre a imagem</legend>
          <RadioCards
            name="tone"
            cols={2}
            compact
            value={tone}
            onValueChange={(value) => setTone(value as BannerTone)}
            options={BANNER_TONES.map((value) => ({ value, label: BANNER_TONE_LABELS[value] }))}
          />
          <p className="hint">O site escurece (ou clareia) a imagem atrás do texto para garantir a leitura.</p>
        </fieldset>

        <FieldRow cols={3}>
          <Field name="durationSeconds" label="Tempo em tela (segundos)" hint={`De ${BANNER_DURATION.min} a ${BANNER_DURATION.max}.`}>
            <Input type="number" inputMode="numeric" min={BANNER_DURATION.min} max={BANNER_DURATION.max} step={1} defaultValue={initial.durationSeconds} />
          </Field>
          <Field name="startsAt" label="Começa em" optional hint="Vazio = assim que for ligado. Horário do estúdio.">
            <Input type="datetime-local" defaultValue={initial.startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </Field>
          <Field name="endsAt" label="Termina em" optional hint="Vazio = até você desligar.">
            <Input type="datetime-local" defaultValue={initial.endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </Field>
        </FieldRow>

        <Switch
          name="enabled"
          label="Banner ligado"
          hint="Desligado, fica guardado aqui como rascunho e não aparece no site. Ligado, entra no carrossel ao salvar (respeitando as datas)."
          defaultChecked={initial.enabled}
          onCheckedChange={setEnabled}
        />

        <FormActions>
          <SubmitButton pendingLabel="Salvando…">{initial.id === null ? "Criar banner" : "Salvar banner"}</SubmitButton>
          <ButtonLink href="/painel/site/banners" variant="ghost">
            {initial.id === null ? "Cancelar" : "Voltar à lista"}
          </ButtonLink>
        </FormActions>
      </ActionForm>

      <section aria-labelledby="banner-previa-titulo" className="card space-y-4 p-4 sm:p-5 xl:sticky xl:top-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="banner-previa-titulo" className="text-texto text-base font-bold">
            Prévia
          </h2>
          <div role="group" aria-label="Tamanho da prévia" className="border-borda inline-flex rounded-campo border p-0.5">
            {(
              [
                ["desktop", "Computador", Monitor],
                ["mobile", "Celular", Smartphone],
              ] as const
            ).map(([value, label, IconComponent]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={cn(
                  "focus-visible:outline-foco inline-flex min-h-11 items-center gap-1.5 rounded-[calc(var(--radius-campo)-2px)] px-3 text-sm font-semibold focus-visible:outline-2",
                  view === value ? "bg-primaria text-sobre-primaria" : "text-texto-suave hover:text-texto",
                )}
              >
                <IconComponent aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-texto-suave text-[0.8125rem] leading-snug">
          É assim que o banner aparece no site, com as cores reais. A prévia muda enquanto você digita; o site só muda quando você salvar com o banner ligado.
        </p>
        <div className={view === "mobile" ? "mx-auto max-w-[19rem]" : undefined}>
          <BannerPreview banner={preview} viewport={view} eyebrow={eyebrow} symbol={symbol} />
        </div>
        <p className="text-texto-suave text-xs">
          {view === "desktop" ? `Computador: proporção de ${BANNER_SIZES.desktop.label}.` : `Celular: proporção de ${BANNER_SIZES.mobile.label}.`}
        </p>

        <div aria-live="polite" className="space-y-2">
          {warnings.length > 0 ? (
            <Alert tone="alerta" title={warnings.length === 1 ? "Um ponto de atenção" : `${warnings.length} pontos de atenção`}>
              <ul className="list-disc space-y-1.5 pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          ) : (
            <p className="text-sucesso flex items-center gap-1.5 text-sm font-medium">
              <CheckCircle2 aria-hidden="true" className="size-4" /> Nenhum ponto de atenção.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
