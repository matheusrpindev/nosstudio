"use client";

import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogClose, useDialogClose } from "@/components/ui/dialog";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/ui/form";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { StringListField } from "@/components/ui/list-fields";
import { cn } from "@/lib/cn";
import {
  AGENDA_CALENDAR_KIND_LABELS,
  AGENDA_COLOR_LABELS,
  AGENDA_COLORS,
  AGENDA_ICON_LABELS,
  AGENDA_ICONS,
  type AgendaCalendarKind,
  type AgendaColor,
  type AgendaIcon,
} from "@/lib/domain";
import { CategoryIcon } from "../icons";
import { TONE_CLASS } from "../ui";
import { deleteChecklistTemplateAction, saveCalendarAction, saveCategoryAction, saveChecklistTemplateAction } from "./actions";

type Option = { value: number; label: string };

function ColorPicker({ defaultValue }: { defaultValue: AgendaColor }) {
  return (
    <Field name="color" label="Cor" group>
      <div className="flex flex-wrap gap-1.5">
        {AGENDA_COLORS.map((color) => (
          <label
            key={color}
            title={AGENDA_COLOR_LABELS[color]}
            className={cn(
              "has-checked:border-texto relative flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco",
              TONE_CLASS[color],
            )}
          >
            <input type="radio" name="color" value={color} defaultChecked={color === defaultValue} className="peer sr-only" aria-label={AGENDA_COLOR_LABELS[color]} />
            <span aria-hidden="true" className="agenda-ponto size-7" />
            <Check aria-hidden="true" className="text-fundo absolute hidden size-4 peer-checked:block" strokeWidth={3} />
          </label>
        ))}
      </div>
    </Field>
  );
}

function IconPicker({ defaultValue }: { defaultValue: AgendaIcon }) {
  return (
    <Field name="icon" label="Ícone" group>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
        {AGENDA_ICONS.map((icon) => (
          <label
            key={icon}
            title={AGENDA_ICON_LABELS[icon]}
            className="border-borda text-texto-suave has-checked:border-detalhe has-checked:bg-detalhe-suave has-checked:text-detalhe hover:border-detalhe flex aspect-square min-h-11 cursor-pointer items-center justify-center rounded-campo border has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco"
          >
            <input type="radio" name="icon" value={icon} defaultChecked={icon === defaultValue} className="sr-only" aria-label={AGENDA_ICON_LABELS[icon]} />
            <CategoryIcon name={icon} className="size-5" />
          </label>
        ))}
      </div>
    </Field>
  );
}

function DialogButtons({ label }: { label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
      <DialogClose>
        <Button variant="secondary">Cancelar</Button>
      </DialogClose>
      <SubmitButton pendingLabel="Salvando…">{label}</SubmitButton>
    </div>
  );
}

/** O formulário fica num componente à parte para pegar o "fechar" do diálogo em volta. */
function ClosingForm({ action, hidden, children }: { action: FormAction; hidden?: Record<string, string | number | null | undefined>; children: ReactNode }) {
  const close = useDialogClose();
  return (
    <ActionForm action={action} hidden={hidden} onSuccess={close} className="space-y-4">
      {children}
    </ActionForm>
  );
}

const editTrigger = (name: string) => (
  <Button variant="ghost" size="sm" icon={<Pencil />} aria-label={`Editar ${name}`}>
    Editar
  </Button>
);

// ----------------------------------------------------------------- categoria
export type CategoryValues = { id: number; name: string; color: AgendaColor; icon: AgendaIcon; blocksDay: boolean; isProduction: boolean };

export function CategoryDialog({ category }: { category?: CategoryValues }) {
  return (
    <Dialog
      trigger={
        category ? (
          editTrigger(category.name)
        ) : (
          <Button variant="secondary" size="sm" icon={<Plus />}>
            Nova categoria
          </Button>
        )
      }
      title={category ? "Editar categoria" : "Nova categoria"}
    >
      <ClosingForm action={saveCategoryAction} hidden={{ id: category?.id }}>
        <Field name="name" label="Nome" required>
          <Input maxLength={60} defaultValue={category?.name ?? ""} autoComplete="off" />
        </Field>
        <ColorPicker defaultValue={category?.color ?? "roxo"} />
        <IconPicker defaultValue={category?.icon ?? "calendar"} />
        <Checkbox name="isProduction" label="É uma produção" hint="Mostra o bloco “Planejamento de gravação” no compromisso (endereço, roteiro, equipamentos…)." defaultChecked={category?.isProduction ?? false} />
        <Checkbox name="blocksDay" label="Dia inteiro ocupa a pessoa" hint="Para férias e indisponibilidade: um dia inteiro desta categoria entra no aviso de conflito." defaultChecked={category?.blocksDay ?? false} />
        <DialogButtons label={category ? "Salvar" : "Criar categoria"} />
      </ClosingForm>
    </Dialog>
  );
}

// -------------------------------------------------------------------- agenda
export type CalendarValues = { id: number; name: string; color: AgendaColor; kind: AgendaCalendarKind };

export function CalendarDialog({ calendar, kinds }: { calendar?: CalendarValues; kinds: AgendaCalendarKind[] }) {
  return (
    <Dialog
      trigger={
        calendar ? (
          editTrigger(calendar.name)
        ) : (
          <Button variant="secondary" size="sm" icon={<Plus />}>
            Nova agenda
          </Button>
        )
      }
      title={calendar ? "Editar agenda" : "Nova agenda"}
    >
      <ClosingForm action={saveCalendarAction} hidden={{ id: calendar?.id }}>
        <Field name="name" label="Nome" required>
          <Input maxLength={60} defaultValue={calendar?.name ?? ""} autoComplete="off" />
        </Field>
        {calendar ? null : (
          <Field name="kind" label="Tipo" hint="As agendas pessoais nascem com a conta de cada pessoa.">
            <Select options={kinds.map((kind) => ({ value: kind, label: AGENDA_CALENDAR_KIND_LABELS[kind] }))} defaultValue="geral" />
          </Field>
        )}
        <ColorPicker defaultValue={calendar?.color ?? "roxo"} />
        <DialogButtons label={calendar ? "Salvar" : "Criar agenda"} />
      </ClosingForm>
    </Dialog>
  );
}

// -------------------------------------------------------------------- modelo
export type TemplateValues = { id: number; name: string; categoryId: number | null; items: string[] };

export function TemplateDialog({ template, categories }: { template?: TemplateValues; categories: Option[] }) {
  return (
    <Dialog
      trigger={
        template ? (
          editTrigger(template.name)
        ) : (
          <Button variant="secondary" size="sm" icon={<Plus />}>
            Novo modelo
          </Button>
        )
      }
      title={template ? "Editar modelo de checklist" : "Novo modelo de checklist"}
      size="lg"
    >
      <ClosingForm action={saveChecklistTemplateAction} hidden={{ id: template?.id }}>
        <Field name="name" label="Nome do modelo" required>
          <Input maxLength={80} defaultValue={template?.name ?? ""} autoComplete="off" placeholder="Ex.: Gravação externa" />
        </Field>
        <Field name="categoryId" label="Tipo de produção" optional hint="Os modelos da categoria do compromisso aparecem primeiro em “Usar modelo”.">
          <Select options={categories} placeholder="Qualquer compromisso" defaultValue={template?.categoryId ?? ""} />
        </Field>
        <StringListField name="items" label="Itens" defaultValue={template?.items ?? []} placeholder="Ex.: Carregar baterias" addLabel="Adicionar" max={60} maxLength={200} />
        <DialogButtons label={template ? "Salvar" : "Criar modelo"} />
      </ClosingForm>
    </Dialog>
  );
}

export function DeleteTemplateButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="danger-ghost" size="sm" icon={<Trash2 />} aria-label={`Excluir ${name}`}>
          Excluir
        </Button>
      }
      title="Excluir este modelo?"
      description={
        <>
          <strong className="text-texto">{name}</strong> sai da lista de modelos. Os compromissos que já usaram os itens continuam com eles.
        </>
      }
      confirmLabel="Excluir modelo"
      action={deleteChecklistTemplateAction}
      hidden={{ id }}
    />
  );
}

// ------------------------------------------------------------ ordem e ativo
/** Setas de ordenar: cada uma é um formulário pequeno ligado à action de mover. */
export function MoveButtons({ action, id, name, first, last }: { action: FormAction; id: number; name: string; first: boolean; last: boolean }) {
  return (
    <span className="flex">
      {(["up", "down"] as const).map((direction) => (
        <ActionForm key={direction} action={action} hidden={{ id, direction }} success="none" className="contents">
          <SubmitButton variant="ghost" size="sm" className="btn-icon text-texto-suave max-sm:size-11" disabled={direction === "up" ? first : last} aria-label={`Mover ${name} para ${direction === "up" ? "cima" : "baixo"}`}>
            {direction === "up" ? <ArrowUp aria-hidden="true" className="size-4" /> : <ArrowDown aria-hidden="true" className="size-4" />}
          </SubmitButton>
        </ActionForm>
      ))}
    </span>
  );
}

export function ActiveButton({ action, id, name, active, locked }: { action: FormAction; id: number; name: string; active: boolean; locked?: boolean }) {
  if (locked) return null;
  return (
    <ActionForm action={action} hidden={{ id, active: active ? undefined : "on" }} className="contents">
      <SubmitButton variant="ghost" size="sm" icon={active ? <EyeOff /> : <Eye />} aria-label={`${active ? "Desativar" : "Reativar"} ${name}`}>
        {active ? "Desativar" : "Reativar"}
      </SubmitButton>
    </ActionForm>
  );
}
