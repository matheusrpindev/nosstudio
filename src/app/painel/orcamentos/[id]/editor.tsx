"use client";

/**
 * Editor de propostas (e de modelos). O rascunho inteiro vive em memória neste componente; os números
 * (preço, sinal, margem) são recalculados ao vivo com as funções puras de `calc.ts`. Ao salvar, o rascunho
 * vai em JSON no campo `payload`, o servidor valida com zod, refaz as contas e grava numa transação.
 */
import { Lock, Save } from "lucide-react";
import { useActionState, useEffect, useEffectEvent, useId, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/cn";
import { keepChoicesOnReset } from "@/lib/form-reset";
import { formatBRL, formatPercent } from "@/lib/format";
import { saveProposalAction } from "../actions";
import { draftNumbers, stepOfField, type EditorStep, type ProposalDraft } from "../draft";
import { ControlStep, type ControlData } from "./control";
import { StepInterno } from "./internal";
import { StepDados, StepEscopo, StepPreco, StepTextos, type StepProps } from "./steps";

type Option = { value: number; label: string };

export type EditorProps = {
  id: number;
  isTemplate: boolean;
  number: string;
  version: number;
  /** Muda a cada gravação no servidor (`updatedAt`): o editor recarrega o rascunho. */
  serverKey: string;
  initialDraft: ProposalDraft;
  clients: Option[];
  users: Option[];
  today: string;
  control: ControlData;
};

export function ProposalEditor({ id, isTemplate, number, version, serverKey, initialDraft, clients, users, today, control }: EditorProps) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(saveProposalAction, initialActionState);

  const [draft, setDraft] = useState<ProposalDraft>(initialDraft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialDraft));
  const [listsKey, setListsKey] = useState(0);
  const [pdfKey, setPdfKey] = useState(0);
  const [tab, setTab] = useState<EditorStep>("dados");
  const [attempted, setAttempted] = useState(false);
  const [seenServerKey, setSeenServerKey] = useState(serverKey);
  const [handledNonce, setHandledNonce] = useState<number | undefined>(undefined);

  // Gravou no servidor (salvar ou mudança de status): recarrega o rascunho com o que ficou gravado.
  if (seenServerKey !== serverKey) {
    setSeenServerKey(serverKey);
    const saved = JSON.stringify(initialDraft);
    if (saved !== JSON.stringify(draft)) {
      setDraft(initialDraft);
      setListsKey((key) => key + 1);
    }
    setBaseline(saved);
    setPdfKey((key) => key + 1);
  }

  // Resposta nova da action de salvar.
  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  if (state.nonce !== undefined && state.nonce !== handledNonce) {
    setHandledNonce(state.nonce);
    if (state.ok) {
      setBaseline(JSON.stringify(draft));
      setAttempted(false);
      setPdfKey((key) => key + 1);
    } else {
      setAttempted(true);
      const first = Object.keys(errors)[0];
      if (first) setTab(stepOfField(first));
    }
  }
  const announce = useEffectEvent(() => {
    if (state.ok && state.message) toast(state.message);
  });
  useEffect(() => {
    if (state.nonce !== undefined) announce();
  }, [state.nonce]);

  const payload = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = payload !== baseline;

  // avisa antes de fechar a aba com alterações não salvas
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const numbers = useMemo(() => draftNumbers(draft), [draft]);
  const patch = (changes: Partial<ProposalDraft>) => setDraft((current) => ({ ...current, ...changes }));
  const stepProps: StepProps = { draft, patch, numbers, errors, attempted, listsKey };

  const tabs = [
    { value: "dados", label: "Dados" },
    { value: "escopo", label: "Escopo" },
    {
      value: "interno",
      label: (
        <span className="inline-flex items-center gap-1.5">
          <Lock aria-hidden="true" className="size-3.5" />
          Cálculo interno
        </span>
      ),
    },
    { value: "preco", label: "Preço ao cliente" },
    { value: "textos", label: "Textos" },
    { value: "pdf", label: isTemplate ? "Ações" : "PDF e controle" },
  ] as const;

  const belowTarget = !isTemplate && numbers.client.totalCents > 0 && numbers.internal.belowTarget;

  return (
    <div>
      <Tabs items={tabs} value={tab} onValueChange={(value) => setTab(value as EditorStep)} aria-label="Etapas do orçamento">
        {/* onReset: todos os campos são controlados; o reset automático do React depois de salvar deixaria caixas e
            selects mostrando o valor de quando a página abriu (ver src/lib/form-reset.ts) */}
        <form id={formId} action={formAction} noValidate className="space-y-4" onReset={keepChoicesOnReset}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="payload" value={payload} />
          {!state.ok && state.message ? (
            <Alert tone="perigo" role="alert" className="mt-5">
              {state.message}
            </Alert>
          ) : null}

          <TabPanel value="dados">
            <StepDados {...stepProps} isTemplate={isTemplate} number={number} version={version} clients={clients} users={users} today={today} />
          </TabPanel>
          <TabPanel value="escopo">
            <StepEscopo {...stepProps} />
          </TabPanel>
          <TabPanel value="interno">
            <StepInterno {...stepProps} isTemplate={isTemplate} onGoToScope={() => setTab("escopo")} />
          </TabPanel>
          <TabPanel value="preco">
            <StepPreco {...stepProps} />
          </TabPanel>
          <TabPanel value="textos">
            <StepTextos {...stepProps} />
          </TabPanel>
        </form>

        <TabPanel value="pdf">
          <ControlStep {...control} dirty={dirty} pdfKey={pdfKey} />
        </TabPanel>
      </Tabs>

      {/* Barra de salvar: sempre visível; no celular fica acima do menu de atalhos. */}
      <div
        className={cn(
          "border-areia shadow-flutuante sticky z-20 mt-6 rounded-cartao border bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4",
          "bottom-[calc(3.75rem+env(safe-area-inset-bottom)+0.5rem)] lg:bottom-4",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" role="status" aria-live="polite">
            <p className={cn("flex items-center gap-2 text-sm font-semibold", dirty ? "text-alerta" : "text-sucesso")}>
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-alerta" : "bg-sucesso")} />
              {dirty ? "Alterações não salvas" : "Tudo salvo"}
            </p>
            <p className="text-cinza truncate text-xs">
              {isTemplate ? "Modelo" : "Total ao cliente"}: <strong className="text-grafite tabular-nums">{formatBRL(numbers.client.totalCents)}</strong>
              {numbers.client.totalCents > 0 ? (
                <>
                  {" "}
                  · sinal <span className="tabular-nums">{formatBRL(numbers.client.entryCents)}</span>
                </>
              ) : null}
              {belowTarget ? <span className="text-alerta font-semibold"> · margem {numbers.internal.netMarginPercent !== null ? formatPercent(numbers.internal.netMarginPercent) : "—"} abaixo da meta</span> : null}
            </p>
          </div>
          <Button type="submit" form={formId} icon={<Save />} loading={pending} disabled={pending}>
            {pending ? "Salvando…" : isTemplate ? "Salvar modelo" : "Salvar proposta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
