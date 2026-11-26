"use client";

import { Check, Minus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/domain";
import {
  ACTIONS,
  MODULE_LABELS,
  MODULES,
  PERMISSION_ACTION_LABELS,
  permissionKey,
  permissionScope,
  PROJECT_SCOPED_PANEL_MODULES,
  RESERVED_MODULES,
  rolePermission,
  type Action,
  type Cell,
  type Module,
  type PermissionKey,
  type PermissionOverrides,
} from "@/lib/permissions";
import { setUserPermissionsAction } from "../actions";

/** Escolha em cada célula: seguir o perfil, permitir (módulo inteiro) ou negar. */
type Choice = "padrao" | "permitir" | "negar";
type Choices = Partial<Record<PermissionKey, Choice>>;

/** Módulos que ainda não têm tela no painel: os ajustes ficam guardados para quando existirem. */
const WITHOUT_SCREEN: readonly Module[] = ["societario", "relatorios"];

function toChoices(overrides: PermissionOverrides): Choices {
  const choices: Choices = {};
  for (const key of overrides.grant) choices[key] = "permitir";
  for (const key of overrides.deny) choices[key] = "negar"; // negação vence concessão
  return choices;
}

function toOverrides(choices: Choices): PermissionOverrides {
  const pick = (wanted: Choice) =>
    (Object.entries(choices) as [PermissionKey, Choice][])
      .filter(([, choice]) => choice === wanted)
      .map(([key]) => key)
      .sort();
  return { grant: pick("permitir"), deny: pick("negar") };
}

const scopeText = (scope: Cell): string => (scope === "todos" ? "pode" : scope === "projetos" ? "só nos projetos dela" : "não pode");

function ScopeIcon({ scope }: { scope: Cell }) {
  const Icon = scope === "todos" ? Check : scope === "projetos" ? Minus : X;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
        scope === "todos" ? "bg-sucesso-claro text-sucesso" : scope === "projetos" ? "bg-alerta-claro text-alerta" : "bg-superficie-alta text-texto-suave",
      )}
    >
      <Icon className="size-3.5" strokeWidth={3} />
    </span>
  );
}

/**
 * Grade módulo × ação. Cada célula mostra o resultado que vale para a pessoa (ícone) e um seletor com três
 * opções: o padrão do perfil, permitir ou negar. O resultado é recalculado na hora com a MESMA função que o
 * servidor usa (`permissionScope`); ao salvar, o servidor valida e decide de novo.
 */
export function PermissionsEditor({ userId, role, initial, canEdit }: { userId: number; role: UserRole; initial: PermissionOverrides; canEdit: boolean }) {
  const [choices, setChoices] = useState<Choices>(() => toChoices(initial));
  const overrides = useMemo(() => toOverrides(choices), [choices]);
  const subject = useMemo(() => ({ role, permissions: overrides }), [role, overrides]);
  const saved = useMemo(() => toOverrides(toChoices(initial)), [initial]);
  const dirty = JSON.stringify(overrides) !== JSON.stringify(saved);
  const adjustments = overrides.grant.length + overrides.deny.length;

  const set = (key: PermissionKey, choice: Choice) =>
    setChoices((current) => {
      const next = { ...current };
      if (choice === "padrao") delete next[key];
      else next[key] = choice;
      return next;
    });

  return (
    <section aria-labelledby="grade-titulo">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="grade-titulo" className="text-texto text-base font-bold">
            O que esta pessoa pode fazer
          </h2>
          <p className="text-texto-suave mt-0.5 text-sm" aria-live="polite">
            {adjustments === 0 ? "Segue o padrão do perfil, sem ajustes." : `${overrides.grant.length} ${overrides.grant.length === 1 ? "permissão a mais" : "permissões a mais"} · ${overrides.deny.length} ${overrides.deny.length === 1 ? "negada" : "negadas"}`}
            {dirty ? " — alterações ainda não salvas." : ""}
          </p>
        </div>
        {canEdit && saved.grant.length + saved.deny.length > 0 ? (
          <ConfirmDialog
            trigger={
              <Button variant="secondary" icon={<RotateCcw />}>
                Voltar ao padrão do perfil
              </Button>
            }
            title="Voltar ao padrão do perfil?"
            description="Todos os ajustes desta pessoa são apagados e ela volta a ter exatamente as permissões do perfil."
            confirmLabel="Voltar ao padrão"
            tone="primary"
            action={async (previous, formData) => {
              const result = await setUserPermissionsAction(previous, formData);
              if (result.ok) setChoices({});
              return result;
            }}
            hidden={{ id: userId, grant: "[]", deny: "[]" }}
          />
        ) : null}
      </div>
      <div className="mb-3">
        <ul className="text-texto-suave flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <ScopeIcon scope="todos" /> pode
          </li>
          <li className="flex items-center gap-1.5">
            <ScopeIcon scope="projetos" /> só nos projetos em que está
          </li>
          <li className="flex items-center gap-1.5">
            <ScopeIcon scope={null} /> não pode
          </li>
        </ul>
      </div>

      <div className="card overflow-hidden">
        {/* cabeçalho das colunas: só no desktop (no celular cada ação leva o próprio rótulo) */}
        <div aria-hidden="true" className="border-borda text-texto-suave hidden grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))] gap-3 border-b px-5 py-3 text-xs font-bold tracking-wide uppercase lg:grid">
          <span>Módulo</span>
          {ACTIONS.map((action) => (
            <span key={action}>{PERMISSION_ACTION_LABELS[action]}</span>
          ))}
        </div>
        <ul className="divide-borda divide-y">
          {MODULES.map((mod) => {
            const reserved = RESERVED_MODULES.includes(mod);
            return (
              <li key={mod} className="px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))] lg:items-start lg:gap-3 lg:py-3">
                <div className="mb-3 lg:mb-0 lg:pt-2">
                  <h3 className="text-texto text-sm font-bold break-words">{MODULE_LABELS[mod]}</h3>
                  {reserved ? <p className="text-texto-suave text-xs">Exclusivo de administradores e sócios.</p> : null}
                  {WITHOUT_SCREEN.includes(mod) && !reserved ? <p className="text-texto-suave text-xs">Ainda sem tela no painel.</p> : null}
                </div>
                {ACTIONS.map((action) => (
                  <PermissionCell
                    key={action}
                    mod={mod}
                    action={action}
                    profile={rolePermission(role, mod, action)}
                    effective={permissionScope(subject, mod, action)}
                    choice={choices[permissionKey(mod, action)] ?? "padrao"}
                    canGrant={!reserved}
                    disabled={!canEdit}
                    onChange={(choice) => set(permissionKey(mod, action), choice)}
                  />
                ))}
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="hint mt-3 list-disc space-y-1 pl-5">
        <li>
          <strong>Permitir</strong> vale para o módulo inteiro (todos os registros), e libera também o “Ver” dele.
        </li>
        <li>
          <strong>Negar</strong> vence qualquer permissão. Negar o “Ver” de um módulo tira todas as ações dele e o item some do menu da pessoa.
        </li>
        <li>
          “Só nos projetos em que está” funciona hoje em {PROJECT_SCOPED_PANEL_MODULES.map((mod) => MODULE_LABELS[mod]).join(" e ")}; nos outros módulos a pessoa precisa da permissão no módulo inteiro para abrir a tela.
        </li>
        <li>As mudanças valem no próximo clique da pessoa, sem ela precisar entrar de novo.</li>
      </ul>

      {/* barra fixa só enquanto há alterações por salvar (no celular ela fica acima da barra de atalhos) */}
      {canEdit && dirty ? (
        <div className="bg-superficie-alta border-borda rounded-cartao shadow-flutuante sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-5 border p-3 lg:bottom-4">
          <ActionForm action={setUserPermissionsAction} hidden={{ id: userId, grant: JSON.stringify(overrides.grant), deny: JSON.stringify(overrides.deny) }} className="flex flex-wrap items-center gap-2 space-y-0">
            <SubmitButton pendingLabel="Salvando…">Salvar permissões</SubmitButton>
            <Button variant="ghost" onClick={() => setChoices(toChoices(initial))}>
              Desfazer
            </Button>
          </ActionForm>
        </div>
      ) : null}
    </section>
  );
}

function PermissionCell({
  mod,
  action,
  profile,
  effective,
  choice,
  canGrant,
  disabled,
  onChange,
}: {
  mod: Module;
  action: Action;
  profile: Cell;
  effective: Cell;
  choice: Choice;
  canGrant: boolean;
  disabled: boolean;
  onChange: (choice: Choice) => void;
}) {
  const label = `${PERMISSION_ACTION_LABELS[action]} em ${MODULE_LABELS[mod]}`;
  return (
    <div className="flex items-center gap-2 py-1 lg:py-0">
      <span className="text-texto-suave w-28 shrink-0 text-[0.8125rem] font-semibold lg:hidden">{PERMISSION_ACTION_LABELS[action]}</span>
      <ScopeIcon scope={effective} />
      <span className="sr-only">
        {label}: {scopeText(effective)}.
      </span>
      <select
        aria-label={`${label} — ajuste`}
        value={choice}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as Choice)}
        className={cn("input min-h-11 min-w-0 flex-1 py-1 pr-7 pl-2 text-base lg:min-h-9 lg:text-[0.8125rem]", choice !== "padrao" && "border-detalhe text-texto font-semibold")}
      >
        <option value="padrao">Padrão: {profile === "todos" ? "sim" : profile === "projetos" ? "projetos" : "não"}</option>
        {canGrant ? <option value="permitir">Permitir</option> : null}
        <option value="negar">Negar</option>
      </select>
    </div>
  );
}
