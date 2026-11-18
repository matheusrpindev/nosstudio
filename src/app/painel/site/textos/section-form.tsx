"use client";

/**
 * Formulário do editor de textos: lê o mapa de `config.ts` e desenha os campos de qualquer seção.
 * Os campos são nomeados pelo caminho (`hero.title`); `parseSectionForm` (build.ts) faz o caminho inverso.
 */
import { Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { ActionForm, Field, SubmitButton, useFieldState, type FormAction } from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { ObjectListField } from "@/components/ui/list-fields";
import { PhoneInput } from "@/components/ui/masked-inputs";
import { MarkdownField } from "@/components/ui/markdown-field";
import { ImageField, type MediaValue } from "@/components/ui/media-fields";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { truncate } from "@/lib/format";
import type { SiteContentKey } from "@/lib/site/content";
import { maxLengthAt, SITE_PAGES, SITE_SECTIONS, type AreaField, type Field as FieldSpec, type ItemField, type LineField, type ListField } from "./config";

const LINK_LIST_ID = "paginas-do-site";

function pick(content: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], content);
}

const asText = (value: unknown) => (typeof value === "string" ? value : "");

type Ctx = {
  sectionKey: SiteContentKey;
  initial: unknown;
  media: Record<number, MediaValue>;
  siteHost: string;
  siteName: string;
  onSiteName: (value: string) => void;
};

// ------------------------------------------------------------ contador
/** "12 de 120 caracteres" — fica vermelho ao passar do limite (o servidor também confere). */
function Counter({ length, max }: { length: number; max: number | null }) {
  if (max === null) return null;
  const over = length > max;
  return (
    <span className={cn("tabular-nums", over && "text-perigo font-semibold")}>
      {length} de {max} caracteres
    </span>
  );
}

function withHint(hint: string | undefined, counter: ReactNode): ReactNode {
  return (
    <>
      {hint}
      {hint && counter ? " · " : null}
      {counter}
    </>
  );
}

// ------------------------------------------------------- texto curto/longo
function TextControl({ field, ctx }: { field: LineField | AreaField; ctx: Ctx }) {
  const value = asText(pick(ctx.initial, field.path));
  const [length, setLength] = useState(value.length);
  const max = maxLengthAt(ctx.sectionKey, field.path);
  const onValue = (next: string) => {
    setLength(next.length);
    if (ctx.sectionKey === "seo" && field.path === "siteName") ctx.onSiteName(next);
  };
  const placeholder = "placeholder" in field ? field.placeholder : undefined;

  let control: ReactNode;
  if (field.type === "phone") {
    control = <PhoneInput defaultValue={value} onValueChange={(next) => onValue(next)} />;
  } else if (field.type === "textarea") {
    control = <Textarea rows={field.rows ?? 3} defaultValue={value} placeholder={placeholder} onChange={(event) => onValue(event.target.value)} />;
  } else {
    control = (
      <Input
        defaultValue={value}
        placeholder={placeholder}
        type={field.type === "email" ? "email" : "text"}
        autoComplete="off"
        autoCapitalize={field.type === "instagram" || field.type === "email" ? "none" : undefined}
        spellCheck={field.type !== "email" && field.type !== "instagram"}
        onChange={(event) => onValue(event.target.value)}
      />
    );
  }

  return (
    <Field name={field.path} label={field.label} required={field.required} hint={withHint(field.hint, field.type === "phone" ? null : <Counter length={length} max={max} />)}>
      {control}
    </Field>
  );
}

// ---------------------------------------------------------------- link
function LinkControl({ field, ctx }: { field: Extract<FieldSpec, { type: "link" }>; ctx: Ctx }) {
  const value = (pick(ctx.initial, field.path) ?? { label: "", href: "" }) as { label: string; href: string };
  return (
    <fieldset className="border-areia rounded-campo min-w-0 border p-4">
      <legend className="label px-1">{field.label}</legend>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
        <Field name={`${field.path}.label`} label="Texto do botão" hint={`Até ${maxLengthAt(ctx.sectionKey, `${field.path}.label`) ?? 80} caracteres. Deixe vazio para esconder o botão (o link abaixo fica guardado, mas não aparece no site).`}>
          <Input defaultValue={asText(value.label)} autoComplete="off" />
        </Field>
        <Field name={`${field.path}.href`} label="Para onde leva" hint="Escolha uma página da lista ou escreva um endereço (https://…).">
          <Input defaultValue={asText(value.href)} list={LINK_LIST_ID} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="/contato" />
        </Field>
      </div>
    </fieldset>
  );
}

// ----------------------------------------------------------- lista
function ListControl({ field, ctx }: { field: ListField; ctx: Ctx }) {
  const initial = (pick(ctx.initial, field.path) ?? []) as Record<string, unknown>[];
  const max = maxLengthAt(ctx.sectionKey, field.path) ?? undefined;
  const createItem = () => Object.fromEntries(field.items.map((spec) => [spec.key, spec.type === "image" ? null : ""]));
  const itemLabel = (item: Record<string, unknown>, index: number) => {
    const first = field.items.find((spec) => spec.type === "text");
    const label = first ? asText(item[first.key]) : "";
    return label || `${field.itemName} ${index + 1}`;
  };

  const renderField = (spec: ItemField, item: Record<string, unknown>, update: (patch: Record<string, unknown>) => void, index: number): ReactNode => {
    const limit = maxLengthAt(ctx.sectionKey, `${field.path}[].${spec.key}`);
    const hint = limit ? `Até ${limit} caracteres.` : undefined;
    const labelText = spec.label;
    switch (spec.type) {
      case "text":
      case "href":
        return (
          <label key={spec.key} className="block min-w-0">
            <span className="label">{labelText}</span>
            <input
              className="input"
              value={asText(item[spec.key])}
              onChange={(event) => update({ [spec.key]: event.target.value })}
              {...(spec.type === "href" ? { list: LINK_LIST_ID, autoCapitalize: "none", spellCheck: false, placeholder: "/servicos ou https://…" } : {})}
              autoComplete="off"
            />
            {hint ? <span className="hint">{hint}</span> : null}
          </label>
        );
      case "textarea":
        return (
          <label key={spec.key} className="block min-w-0">
            <span className="label">{labelText}</span>
            <Textarea rows={2} value={asText(item[spec.key])} onChange={(event) => update({ [spec.key]: event.target.value })} />
            {hint ? <span className="hint">{hint}</span> : null}
          </label>
        );
      case "markdown":
        return (
          <MarkdownField
            key={spec.key}
            name={`_${field.path}.${index}.${spec.key}`}
            label={labelText}
            defaultValue={asText(item[spec.key])}
            rows={7}
            hint={hint}
            onChange={(value) => update({ [spec.key]: value })}
          />
        );
      case "image": {
        const id = typeof item[spec.key] === "number" ? (item[spec.key] as number) : null;
        return (
          <ImageField
            key={spec.key}
            name={`_${field.path}.${index}.${spec.key}`}
            label={labelText}
            hint={spec.hint}
            aspect={spec.aspect ?? "1/1"}
            defaultValue={id ? (ctx.media[id] ?? null) : null}
            onChange={(media) => update({ [spec.key]: media?.id ?? null })}
          />
        );
      }
    }
  };

  return (
    <ObjectListField<Record<string, unknown>>
      name={field.path}
      label={field.label}
      hint={field.hint}
      defaultValue={initial}
      addLabel={field.addLabel}
      max={max}
      createItem={createItem}
      itemLabel={itemLabel}
      emptyLabel="Nada por aqui ainda."
      renderItem={(item, update, index) => <div className="grid gap-3">{field.items.map((spec) => renderField(spec, item, update, index))}</div>}
    />
  );
}

// ------------------------------------------------------------------ SEO
function SeoPageControl({ field, ctx }: { field: Extract<FieldSpec, { type: "seoPage" }>; ctx: Ctx }) {
  const initial = (pick(ctx.initial, field.path) ?? { title: "", description: "" }) as { title: string; description: string };
  const [title, setTitle] = useState(asText(initial.title));
  const [description, setDescription] = useState(asText(initial.description));
  const titleMax = maxLengthAt(ctx.sectionKey, `${field.path}.title`);
  const descriptionMax = maxLengthAt(ctx.sectionKey, `${field.path}.description`);
  const isHome = field.publicPath === "/";
  const shownTitle = isHome ? title || ctx.siteName : `${title}${ctx.siteName ? ` · ${ctx.siteName}` : ""}`;
  const crumbs = field.publicPath === "/" ? "" : ` › ${field.publicPath.slice(1)}`;

  return (
    <fieldset className="border-areia rounded-campo min-w-0 border p-4">
      <legend className="label px-1">{field.label}</legend>
      <div className="space-y-4">
        <Field name={`${field.path}.title`} label="Título" required={field.required} hint={<>O Google costuma mostrar até uns 60 caracteres. · <Counter length={title.length} max={titleMax} /></>}>
          <Input defaultValue={asText(initial.title)} onChange={(event) => setTitle(event.target.value)} autoComplete="off" />
        </Field>
        <Field name={`${field.path}.description`} label="Descrição" hint={<>Uma ou duas frases que convidem a clicar. Vazia, vale a descrição da página inicial. · <Counter length={description.length} max={descriptionMax} /></>}>
          <Textarea rows={2} defaultValue={asText(initial.description)} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <div className="rounded-campo bg-offwhite border-areia border p-3" aria-label={`Prévia no Google: ${field.label}`} role="group">
          <p className="text-cinza mb-1 text-[0.6875rem] font-bold tracking-wider uppercase">Prévia no Google</p>
          <p className="text-cinza truncate text-xs">
            {ctx.siteHost}
            {crumbs}
          </p>
          <p className="mt-0.5 text-[1.0625rem] leading-snug text-[#1a0dab]">{truncate(shownTitle, 60) || "Sem título"}</p>
          <p className="text-cinza mt-0.5 text-[0.8125rem] leading-snug break-words">{truncate(description, 160) || "Sem descrição."}</p>
        </div>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------- um campo
function Control({ field, ctx }: { field: FieldSpec; ctx: Ctx }) {
  switch (field.type) {
    case "text":
    case "email":
    case "phone":
    case "instagram":
    case "textarea":
      return <TextControl field={field} ctx={ctx} />;
    case "markdown": {
      const max = maxLengthAt(ctx.sectionKey, field.path);
      return (
        <MarkdownField
          name={field.path}
          label={field.label}
          defaultValue={asText(pick(ctx.initial, field.path))}
          rows={field.rows ?? 8}
          required={field.required}
          hint={[field.hint, max ? `Até ${max.toLocaleString("pt-BR")} caracteres.` : null].filter(Boolean).join(" ")}
        />
      );
    }
    case "switch":
      return <Switch name={field.path} label={field.label} hint={field.hint} defaultChecked={Boolean(pick(ctx.initial, field.path))} />;
    case "link":
      return <LinkControl field={field} ctx={ctx} />;
    case "image": {
      const id = pick(ctx.initial, field.path);
      return (
        <ImageField
          name={field.path}
          label={field.label}
          hint={field.hint}
          aspect={field.aspect}
          defaultValue={typeof id === "number" ? (ctx.media[id] ?? null) : null}
        />
      );
    }
    case "list":
      return <ListControl field={field} ctx={ctx} />;
    case "seoPage":
      return <SeoPageControl field={field} ctx={ctx} />;
  }
}

/** Mostra num bloco só se algum campo dele tiver erro (para avisar de erros em blocos fora da tela). */
function ErrorSummary() {
  const form = useFieldState("_form");
  return form.error ? <Alert tone="perigo">{form.error}</Alert> : null;
}

// --------------------------------------------------------------- editor
export function SectionForm({
  sectionKey,
  initial,
  media,
  siteHost,
  action,
}: {
  sectionKey: SiteContentKey;
  initial: unknown;
  media: Record<number, MediaValue>;
  siteHost: string;
  action: FormAction;
}) {
  const section = SITE_SECTIONS[sectionKey];
  const [siteName, setSiteName] = useState(sectionKey === "seo" ? asText(pick(initial, "siteName")) : "");
  const ctx: Ctx = { sectionKey, initial, media, siteHost, siteName, onSiteName: setSiteName };

  return (
    <ActionForm action={action} hidden={{ _section: sectionKey }} className="space-y-5">
      <datalist id={LINK_LIST_ID}>
        {SITE_PAGES.map((page) => (
          <option key={page.href} value={page.href}>
            {page.label}
          </option>
        ))}
      </datalist>
      <ErrorSummary />

      {section.notice ? (
        <Alert tone={section.notice.tone} title={section.notice.title}>
          {section.notice.text}
        </Alert>
      ) : null}

      {section.groups.length >= 4 ? (
        <nav aria-label="Blocos desta página" className="flex flex-wrap gap-2">
          {section.groups.map((group) => (
            <a key={group.id} href={`#bloco-${group.id}`} className="btn btn-secondary btn-sm min-h-11 sm:min-h-9">
              {group.title}
            </a>
          ))}
        </nav>
      ) : null}

      {section.groups.map((group) => (
        <Card key={group.id} as="section" aria-labelledby={`titulo-${group.id}`} className="scroll-mt-20" >
          <div id={`bloco-${group.id}`} className="scroll-mt-20" />
          <CardHeader as="h2" id={`titulo-${group.id}`} title={group.title} description={group.description} />
          <div className="mt-5 space-y-5">
            {group.fields.map((field) => (
              <Control key={field.path} field={field} ctx={ctx} />
            ))}
          </div>
        </Card>
      ))}

      <div className="rounded-cartao border-areia shadow-flutuante sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom)+0.5rem)] z-20 flex items-center gap-3 border bg-white/95 p-3 backdrop-blur lg:bottom-4">
        <SubmitButton icon={<Save />} pendingLabel="Salvando…">
          Salvar alterações
        </SubmitButton>
        <p className="text-cinza min-w-0 text-[0.8125rem] leading-snug sm:text-sm">As mudanças aparecem no site assim que você salva.</p>
      </div>
    </ActionForm>
  );
}
