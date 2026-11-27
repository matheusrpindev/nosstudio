"use client";

import Link from "next/link";
import { Fragment, useActionState, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { keepChoicesOnReset } from "@/lib/form-reset";
import { SERVICE_INTEREST_LABELS, SERVICE_INTERESTS, type ServiceInterest } from "@/lib/domain";
import {
  EVENT_GUEST_OPTIONS,
  EVENT_SERVICE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  LEAD_HONEYPOT_FIELD,
  LEAD_STARTED_AT_FIELD,
  knownPackageName,
  leadExtraFields,
  type LeadSuccess,
} from "@/lib/site/lead-form-fields";
import { submitLeadAction } from "@/server/leads/actions";
import { Icon } from "./marks";

/**
 * Formulário público de contato/orçamento. O contrato está em src/lib/site/lead-form-fields.ts (nomes de campo,
 * anti-spam) e src/lib/site/lead-form.ts (validação — só no servidor: este componente não importa o zod); a
 * gravação, em `submitLeadAction`. Aqui fica só a interface.
 *
 * Variantes:
 * - "compact" (home): nome, WhatsApp, serviço de interesse, mensagem, consentimento.
 * - "full" (contato e páginas de serviço) — o formulário "inteligente" do briefing v2, seção 10: nome, empresa,
 *   WhatsApp, e-mail, serviço, objetivo e observações, mais os campos do TIPO do serviço escolhido
 *   (`leadExtraFields`): marketing → segmento e perfil; audiovisual → tipo e previsão; evento → data e local.
 * - "event" (Eventos e Casamentos), seção 09: nome, WhatsApp, e-mail, tipo, data, horário, cidade, local,
 *   convidados, serviços e observações. O tipo de evento decide o interesse gravado no lead.
 *
 * A página que o hospeda continua estática: `?servico=…&pacote=…` são lidos no navegador (ver
 * `packageContactHref` / `serviceContactHref` em ./text).
 */
export type LeadFormProps = {
  variant?: "compact" | "full" | "event";
  /** Caminho da página onde o formulário está ("/", "/contato", "/casamentos"…). Vai gravado no lead. */
  originPath: string;
  /** Texto do consentimento: `content.contactPage.consentText`. O link da política entra sozinho no final. */
  consentText: string;
  /** Texto do botão: `content.contactPage.submitLabel` (ou o da página). */
  submitLabel: string;
  /** Título e texto de apoio dentro do cartão do formulário (opcionais). */
  title?: string;
  text?: string;
  headingLevel?: 2 | 3;
  /** Serviço que já vem selecionado. */
  defaultInterest?: ServiceInterest;
  /** Variante "event": tipo de evento que já vem preenchido (ex.: "Casamento"). */
  defaultEventType?: string;
  /** Plano/serviço de origem, quando o formulário está na página de um serviço específico. */
  packageName?: string;
  /**
   * Nomes dos planos e serviços publicados (`getLeadOriginNames()`): `?pacote=…` da URL só é aceito se for um
   * deles. Sem esta lista o parâmetro é ignorado. (O servidor confere de novo em `submitLeadAction`.)
   */
  packageOptions?: readonly string[];
  privacyHref?: string;
  /** Contorno fino — use quando o formulário estiver sobre o papel (sobre roxo/grafite não precisa). */
  bordered?: boolean;
  id?: string;
  className?: string;
};

type Values = Record<string, string>;
type State = ActionState<LeadSuccess>;

const INITIAL: State = { ok: false };
const REQUIRED = new Set(["name", "whatsapp", "serviceInterest", "eventType", "consent"]);

/** Máscara simples de telefone brasileiro enquanto digita: (11) 91234-5678. */
function maskPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// A query string é lida no navegador (useSyncExternalStore evita erro de hidratação); a página fica estática.
const subscribeNever = () => () => {};
const readSearch = () => window.location.search;
const readSearchOnServer = () => "";

export function LeadForm(props: LeadFormProps) {
  // "Enviar outra mensagem" remonta o formulário do zero.
  const [round, setRound] = useState(0);
  return <LeadFormInner key={round} {...props} onRestart={() => setRound((n) => n + 1)} />;
}

function LeadFormInner({
  variant = "full",
  originPath,
  consentText,
  submitLabel,
  title,
  text,
  headingLevel = 3,
  defaultInterest,
  defaultEventType = "",
  packageName,
  packageOptions,
  privacyHref = "/privacidade",
  bordered = false,
  id,
  className,
  onRestart,
}: LeadFormProps & { onRestart: () => void }) {
  const [state, formAction, pending] = useActionState<State, FormData>(submitLeadAction, INITIAL);
  const uid = useId();
  const Title = `h${headingLevel}` as "h2" | "h3";

  const search = useSyncExternalStore(subscribeNever, readSearch, readSearchOnServer);
  const query = new URLSearchParams(search);
  const queryInterest = SERVICE_INTERESTS.find((value) => value === query.get("servico"));
  const queryPackage = knownPackageName(query.get("pacote"), packageOptions ?? []);

  // Campos controlados: o que a pessoa digitou sobrevive a um erro de validação (com e sem JS).
  const [values, setValues] = useState<Values>(() => state.values ?? {});
  const [consent, setConsent] = useState(() => ["on", "true"].includes(state.values?.consent ?? ""));
  const [services, setServices] = useState<string[]>([]);
  const [edited, setEdited] = useState<{ nonce?: number; names: string[] }>({ names: [] });

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const startedAt = useRef("");
  const startedAtInput = useRef<HTMLInputElement>(null);

  const interest = values.serviceInterest ?? queryInterest ?? defaultInterest ?? "";
  /** Campos adicionais do tipo do serviço escolhido (só na variante "full"). */
  const extra = variant === "full" ? leadExtraFields(interest) : [];
  const pkg = packageName ?? queryPackage;
  const value = (name: string, fallback = "") => values[name] ?? fallback;
  const errorOf = (name: string) =>
    edited.nonce === state.nonce && edited.names.includes(name) ? undefined : state.fieldErrors?.[name];
  const fieldId = (name: string) => `${uid}-${name}`;

  function change(name: string, next: string) {
    setValues((current) => ({ ...current, [name]: next }));
    touch(name);
  }
  function touch(name: string) {
    if (!state.fieldErrors?.[name]) return;
    setEdited((current) =>
      current.nonce === state.nonce
        ? { nonce: state.nonce, names: [...current.names, name] }
        : { nonce: state.nonce, names: [name] },
    );
  }

  // Momento em que o formulário apareceu (sinal anti-spam). Guardado uma vez e reaplicado depois de CADA
  // renderização (efeito sem lista de dependências, de propósito): num <input type="hidden"> o valor é o próprio
  // atributo `value`, que o React regrava com o `defaultValue=""` toda vez que o formulário renderiza de novo
  // (a cada tecla digitada) e ao concluir a action — sem isto o campo chegava vazio ao servidor.
  useEffect(() => {
    if (!startedAt.current) startedAt.current = String(Date.now());
    if (startedAtInput.current && startedAtInput.current.value !== startedAt.current) startedAtInput.current.value = startedAt.current;
  });

  // Foco gerenciado depois de cada resposta: sucesso → título; erro → primeiro campo inválido (ou o aviso).
  useEffect(() => {
    if (state.nonce === undefined) return;
    if (state.ok) {
      successRef.current?.focus();
      return;
    }
    const firstInvalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (firstInvalid ?? alertRef.current)?.focus();
  }, [state.nonce, state.ok]);

  if (state.ok && state.data) {
    return (
      <div id={id} className={cn("s-form s-form__success", bordered && "s-form--bordered", className)} data-tone="paper">
        <span className="s-form__success-mark" aria-hidden="true">
          <Icon name="check" />
        </span>
        <Title className="s-h3 s-form__title" tabIndex={-1} ref={successRef}>
          {state.data.title}
        </Title>
        <p className="s-lead">{state.data.text}</p>
        {state.data.whatsappUrl ? (
          <a className="s-btn s-btn--primary" href={state.data.whatsappUrl} target="_blank" rel="noopener noreferrer" data-track="whatsapp:formulario">
            <span>Continuar no WhatsApp</span>
            <Icon name="whatsapp" />
          </a>
        ) : null}
        <button type="button" className="s-textbtn" onClick={onRestart}>
          Enviar outra mensagem
        </button>
      </div>
    );
  }

  /** Atributos comuns de um campo: id, name, erro ligado por aria-describedby. */
  const control = (name: string) => {
    const error = errorOf(name);
    return {
      id: fieldId(name),
      name,
      "aria-invalid": error ? (true as const) : undefined,
      "aria-describedby": error ? `${fieldId(name)}-erro` : undefined,
      "aria-required": REQUIRED.has(name) ? (true as const) : undefined,
    };
  };
  const field = (name: string, label: ReactNode, input: ReactNode) => (
    <div className="s-field">
      <label htmlFor={fieldId(name)}>
        {label}
        {REQUIRED.has(name) ? <span aria-hidden="true"> *</span> : null}
      </label>
      {input}
      {errorOf(name) ? (
        <p className="s-error" id={`${fieldId(name)}-erro`}>
          {errorOf(name)}
        </p>
      ) : null}
    </div>
  );
  const textInput = (name: string, label: ReactNode, attrs: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    field(name, label, <input type="text" {...control(name)} value={value(name)} onChange={(e) => change(name, e.target.value)} {...attrs} />);
  const select = (name: string, label: ReactNode, options: readonly string[], current: string) =>
    field(
      name,
      label,
      <select {...control(name)} value={current} onChange={(e) => change(name, e.target.value)}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>,
    );
  const optional = <small> (opcional)</small>;

  const nameField = textInput("name", "Nome", { autoComplete: "name", maxLength: 120 });
  const whatsappField = field(
    "whatsapp",
    "WhatsApp",
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(00) 00000-0000"
      maxLength={30}
      {...control("whatsapp")}
      value={value("whatsapp")}
      onChange={(e) => change("whatsapp", maskPhone(e.target.value))}
    />,
  );
  const emailField = textInput("email", <>E-mail{optional}</>, { type: "email", inputMode: "email", autoComplete: "email", maxLength: 160 });
  const interestField = field(
    "serviceInterest",
    "Serviço de interesse",
    <select {...control("serviceInterest")} value={interest} onChange={(e) => change("serviceInterest", e.target.value)}>
      <option value="">Selecione</option>
      {SERVICE_INTERESTS.map((option) => (
        <option key={option} value={option}>
          {SERVICE_INTEREST_LABELS[option]}
        </option>
      ))}
    </select>,
  );
  const dateField = (label: ReactNode) => textInput("eventDate", label, { type: "date" });
  const cityField = textInput("city", <>Cidade{optional}</>, { autoComplete: "address-level2", maxLength: 120 });
  const locationField = textInput("eventLocation", <>Local{optional}</>, { placeholder: "Espaço, igreja, salão, empresa…", maxLength: 160 });
  const messageField = field(
    "message",
    variant === "compact" ? "Mensagem" : <>Observações{optional}</>,
    <textarea
      rows={variant === "compact" ? 3 : 5}
      maxLength={2000}
      placeholder={variant === "event" ? "O que não pode faltar no registro?" : "Conte um pouco da ideia"}
      {...control("message")}
      value={value("message")}
      onChange={(e) => change("message", e.target.value)}
    />,
  );
  /** Campos que só aparecem para o tipo do serviço escolhido. O servidor grava só os do tipo (buildLeadRecord). */
  const EXTRA: Record<string, ReactNode> = {
    segment: textInput("segment", <>Segmento do negócio{optional}</>, { placeholder: "Alimentação, moda, saúde…", maxLength: 120 }),
    profile: textInput("profile", <>Perfil da marca{optional}</>, { placeholder: "@instagram ou site", maxLength: 160, autoCapitalize: "none" }),
    productionType: textInput("productionType", <>Tipo de produção{optional}</>, { placeholder: "Institucional, Reels, ensaio, produto…", maxLength: 160 }),
    timeframe: textInput("timeframe", <>Previsão{optional}</>, { placeholder: "Quando você pretende gravar?", maxLength: 120 }),
    eventDate: dateField(<>Data do evento{optional}</>),
    eventLocation: locationField,
    city: cityField,
  };
  const extraRows: string[][] = [];
  for (let i = 0; i < extra.length; i += 2) extraRows.push(extra.slice(i, i + 2));

  const consentError = errorOf("consent");
  return (
    <form
      id={id}
      ref={formRef}
      action={formAction}
      // campos controlados: depois de um erro, o reset automático do React não pode desmarcar o consentimento
      // nem esvaziar os selects que a pessoa já escolheu (ver src/lib/form-reset.ts)
      onReset={keepChoicesOnReset}
      noValidate
      className={cn("s-form", bordered && "s-form--bordered", className)}
      data-tone="paper"
      aria-busy={pending || undefined}
    >
      {title ? <Title className="s-h3 s-form__title">{title}</Title> : null}
      {text ? <p className="s-muted">{text}</p> : null}
      <p className="s-form__note">
        Campos com <span aria-hidden="true">*</span>
        <span className="sr-only">asterisco</span> são obrigatórios.
      </p>

      {state.message && !state.ok && !state.fieldErrors ? (
        <p className="s-form__alert" role="alert" tabIndex={-1} ref={alertRef}>
          {state.message}
        </p>
      ) : null}

      <div className="s-form__row">
        {nameField}
        {whatsappField}
      </div>

      {variant === "compact" ? (
        <>
          {interestField}
          {messageField}
        </>
      ) : null}

      {variant === "full" ? (
        <>
          <div className="s-form__row">
            {textInput("company", <>Empresa{optional}</>, { autoComplete: "organization", maxLength: 120 })}
            {emailField}
          </div>
          <div className="s-form__row">
            {interestField}
            {textInput("objective", <>Objetivo{optional}</>, { placeholder: "O que você quer alcançar?", maxLength: 300 })}
          </div>
          {/* O grupo existe sempre (região viva): quem usa leitor de tela é avisado quando os campos mudam. */}
          <div className="s-form__group" role="group" aria-label="Detalhes do pedido" aria-live="polite" hidden={extraRows.length === 0}>
            {extraRows.map((row) => (
              <div className="s-form__row" key={row.join("-")}>
                {row.map((name) => (
                  <Fragment key={name}>{EXTRA[name]}</Fragment>
                ))}
              </div>
            ))}
          </div>
          {messageField}
        </>
      ) : null}

      {variant === "event" ? (
        <>
          <div className="s-form__row">
            {emailField}
            {select("eventType", "Tipo de evento", EVENT_TYPE_OPTIONS, value("eventType", defaultEventType))}
          </div>
          <div className="s-form__group">
            <div className="s-form__row">
              {dateField(<>Data{optional}</>)}
              {textInput("startTime", <>Horário{optional}</>, { type: "time" })}
            </div>
            <div className="s-form__row">
              {cityField}
              {locationField}
            </div>
            {select("guests", <>Convidados{optional}</>, EVENT_GUEST_OPTIONS, value("guests"))}
            <fieldset className="s-choices">
              <legend>Serviços{optional}</legend>
              <div className="s-choices__list">
                {EVENT_SERVICE_OPTIONS.map((option) => (
                  <label key={option} className="s-choice">
                    <input
                      type="checkbox"
                      name="services"
                      value={option}
                      checked={services.includes(option)}
                      onChange={(e) => setServices((current) => (e.target.checked ? [...current, option] : current.filter((item) => item !== option)))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          {messageField}
        </>
      ) : null}

      <div className="s-check">
        <input
          type="checkbox"
          id={fieldId("consent")}
          name="consent"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            touch("consent");
          }}
          aria-required
          aria-invalid={consentError ? true : undefined}
          aria-describedby={consentError ? `${fieldId("consent")}-erro` : undefined}
        />
        <label htmlFor={fieldId("consent")}>
          {consentText} Veja a <Link href={privacyHref}>Política de Privacidade</Link>. <span aria-hidden="true">*</span>
        </label>
        {consentError ? (
          <p className="s-error" id={`${fieldId("consent")}-erro`}>
            {consentError}
          </p>
        ) : null}
      </div>

      {/* Campo-isca: pessoas não veem nem alcançam pelo teclado; robôs preenchem e são descartados. */}
      <div className="s-trap" aria-hidden="true">
        <label htmlFor={fieldId("isca")}>Não preencha este campo</label>
        <input type="text" id={fieldId("isca")} name={LEAD_HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <input type="hidden" name={LEAD_STARTED_AT_FIELD} ref={startedAtInput} defaultValue="" />
      <input type="hidden" name="originPath" value={originPath} />
      {pkg ? <input type="hidden" name="packageName" value={pkg} /> : null}

      <button type="submit" className="s-btn s-btn--primary s-btn--block" disabled={pending}>
        <span>{pending ? "Enviando…" : submitLabel.trim() || "Enviar"}</span>
        <Icon name="arrow" />
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? "Enviando o formulário…" : ""}
      </p>
    </form>
  );
}
