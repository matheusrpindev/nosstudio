"use client";

/** Demonstrações interativas da vitrine (precisam de estado/funções no cliente). */
import { useActionState } from "react";
import { Board, type BoardCard, type BoardColumn } from "@/components/ui/board";
import { ObjectListField, StringListField } from "@/components/ui/list-fields";
import { MarkdownField } from "@/components/ui/markdown-field";
import { MoneyInput, PhoneInput } from "@/components/ui/masked-inputs";
import { FileField, GalleryField, ImageField } from "@/components/ui/media-fields";
import { demoEchoAction, demoMoveAction, type DemoEcho } from "./actions";
import type { ActionState } from "@/lib/action-state";

// ------------------------------------------------------------------ Board
type DemoCard = BoardCard & { title: string; note: string; tag: string };

const COLUMNS: BoardColumn[] = [
  { id: "a-fazer", title: "A fazer", tone: "neutral" },
  { id: "em-andamento", title: "Em andamento", tone: "roxo" },
  { id: "em-revisao", title: "Em revisão", tone: "alerta" },
  { id: "aprovado", title: "Aprovado", tone: "lima" },
  { id: "concluido", title: "Concluído", tone: "sucesso" },
  { id: "bloqueada", title: "Recusa (teste de erro)", tone: "perigo" },
];

const CARDS: DemoCard[] = [
  { id: 1, columnId: "a-fazer", label: "Exemplo A", title: "Exemplo A", note: "Roteiro do vídeo", tag: "Vídeo" },
  { id: 2, columnId: "a-fazer", label: "Exemplo B", title: "Exemplo B", note: "Calendário do mês", tag: "Conteúdo" },
  { id: 3, columnId: "a-fazer", label: "Exemplo C", title: "Exemplo C", note: "Briefing inicial", tag: "Marca" },
  { id: 4, columnId: "em-andamento", label: "Exemplo D", title: "Exemplo D", note: "Edição do material", tag: "Vídeo" },
  { id: 5, columnId: "em-andamento", label: "Exemplo E", title: "Exemplo E", note: "Legendas e capas", tag: "Conteúdo" },
  { id: 6, columnId: "em-revisao", label: "Exemplo F", title: "Exemplo F", note: "Ajustes pedidos", tag: "Foto" },
  { id: 7, columnId: "concluido", label: "Exemplo G", title: "Exemplo G", note: "Entregue", tag: "Foto" },
];

export function BoardDemo() {
  return (
    <Board
      label="Quadro de demonstração"
      columns={COLUMNS}
      cards={CARDS}
      onMove={demoMoveAction}
      emptyLabel="Nada nesta etapa."
      renderCard={(card) => (
        <>
          <p className="text-grafite text-sm leading-snug font-semibold">{card.title}</p>
          <p className="text-cinza mt-0.5 text-[0.8125rem]">{card.note}</p>
          <span className="badge badge-roxo mt-2">{card.tag}</span>
        </>
      )}
    />
  );
}

// ------------------------------------------------------------------ formulário
type Deliverable = { label: string; quantity: number };
type ChecklistItem = { id: string; text: string; done: boolean };

const initialState: ActionState<DemoEcho> = { ok: false };

export function FormDemo({ children }: { children?: React.ReactNode }) {
  const [state, formAction, pending] = useActionState(demoEchoAction, initialState);

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-2" data-demo-form>
      <div className="space-y-8">
        <StringListField
          name="itens"
          label="Itens do serviço (StringListField)"
          defaultValue={["Roteiro", "Captação", "Edição"]}
          placeholder="Ex.: Legendas"
          addLabel="Adicionar"
          max={8}
          hint="Enter adiciona. As setas mudam a ordem."
        />

        <ObjectListField<Deliverable>
          name="entregaveis"
          label="Entregáveis (ObjectListField)"
          defaultValue={[
            { label: "Vídeos curtos", quantity: 4 },
            { label: "Fotos tratadas", quantity: 20 },
          ]}
          createItem={() => ({ label: "", quantity: 1 })}
          itemLabel={(item) => item.label}
          addLabel="Adicionar entregável"
          renderItem={(item, update, index) => (
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <input
                className="input"
                value={item.label}
                placeholder="O que será entregue"
                aria-label={`Entregável ${index + 1}: descrição`}
                onChange={(event) => update({ label: event.target.value })}
              />
              <input
                className="input"
                type="number"
                min={0}
                inputMode="numeric"
                value={item.quantity}
                aria-label={`Entregável ${index + 1}: quantidade`}
                onChange={(event) => update({ quantity: Number(event.target.value) || 0 })}
              />
            </div>
          )}
        />

        <ObjectListField<ChecklistItem>
          name="checklist"
          label="Checklist (ObjectListField)"
          defaultValue={[
            { id: "c1", text: "Confirmar local", done: true },
            { id: "c2", text: "Separar equipamento", done: false },
          ]}
          createItem={() => ({ id: crypto.randomUUID(), text: "", done: false })}
          itemLabel={(item) => item.text}
          addLabel="Adicionar tarefa"
          max={6}
          renderItem={(item, update, index) => (
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="checkbox"
                checked={item.done}
                aria-label={`Tarefa ${index + 1} concluída`}
                onChange={(event) => update({ done: event.target.checked })}
              />
              <input
                className="input"
                value={item.text}
                placeholder="Tarefa"
                aria-label={`Tarefa ${index + 1}`}
                onChange={(event) => update({ text: event.target.value })}
              />
            </div>
          )}
        />
      </div>

      <div className="space-y-8">
        <MarkdownField
          name="descricao"
          label="Descrição (MarkdownField)"
          rows={6}
          defaultValue={"Texto de **exemplo** com *ênfase*.\n\n- primeiro item\n- segundo item"}
          hint="Aparece formatado onde o texto for exibido."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="demo-valor">
              Valor (MoneyInput)
            </label>
            <MoneyInput id="demo-valor" name="valor" defaultValue={1090000} aria-describedby="demo-valor-dica" />
            <p className="hint" id="demo-valor-dica">
              Digite só os números; os dois últimos são os centavos.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="demo-telefone">
              Telefone (PhoneInput)
            </label>
            <PhoneInput id="demo-telefone" name="telefone" defaultValue="11912345678" />
          </div>
        </div>

        {children}
      </div>

      <div className="border-areia grid gap-8 border-t pt-8 lg:col-span-2 lg:grid-cols-2">
        <div className="space-y-8">
          <ImageField name="capa" label="Capa (ImageField)" aspect="16/9" hint="Imagens são públicas: vão para o site otimizadas (WebP)." />
          <FileField name="contrato" label="Contrato (FileField)" hint="Arquivo privado: só abre com login no painel." />
        </div>
        <GalleryField name="galeria" label="Galeria (GalleryField)" max={6} hint="A ordem aqui é a ordem em que as imagens aparecem." />
      </div>

      <div className="lg:col-span-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Enviando…" : "Enviar para o servidor (demonstração)"}
        </button>
        <div aria-live="polite" className="mt-4">
          {state.message ? (
            <p className={state.ok ? "text-sucesso text-sm font-semibold" : "field-error"}>{state.message}</p>
          ) : null}
          {state.data ? (
            <pre data-demo-echo className="border-areia bg-offwhite rounded-campo text-grafite mt-2 overflow-x-auto border p-3 text-xs leading-relaxed">
              {JSON.stringify(state.data, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </form>
  );
}
