"use client";

import { Copy, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogClose } from "@/components/ui/dialog";
import { Drawer } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { kitConfirmAction } from "./actions";

/** Demonstrações que precisam de estado/handlers no cliente. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => toast("Alterações salvas.")}>
        Toast de sucesso
      </Button>
      <Button variant="secondary" onClick={() => toast.error("Não foi possível salvar. Tente de novo.")}>
        Toast de erro
      </Button>
      <Button variant="secondary" onClick={() => toast.info("Proposta copiada para a área de transferência.")}>
        Toast informativo
      </Button>
    </div>
  );
}

export function LoadingButtonDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      loading={loading}
      onClick={() => {
        setLoading(true);
        window.setTimeout(() => setLoading(false), 1500);
      }}
    >
      {loading ? "Gerando…" : "Com loading"}
    </Button>
  );
}

/** Menu de ações de uma linha + ConfirmDialog controlado (o padrão para "Excluir" dentro de menus). */
export function RowMenuDemo() {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <DropdownMenu
        trigger={
          <IconButton aria-label="Mais ações">
            <EllipsisVertical />
          </IconButton>
        }
      >
        <DropdownMenuLabel>Proposta #12</DropdownMenuLabel>
        <DropdownMenuItem icon={<Pencil />} href="/painel/kit">
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Copy />} onSelect={() => toast.info("Duplicado (demonstração).")}>
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => setConfirming(true)}>
          Excluir
        </DropdownMenuItem>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir a proposta #12?"
        description="Esta ação não pode ser desfeita. (Demonstração: nada é apagado.)"
        confirmLabel="Excluir"
        action={kitConfirmAction}
        hidden={{ id: 12 }}
      />
    </>
  );
}

export function OverlayDemos() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog
        trigger={<Button variant="secondary">Abrir Dialog</Button>}
        title="Registrar interação"
        description="Um diálogo comum: título, descrição, conteúdo e rodapé com botões."
        footer={
          <>
            <DialogClose>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <DialogClose>
              <Button onClick={() => toast("Interação registrada (demonstração).")}>Salvar</Button>
            </DialogClose>
          </>
        }
      >
        <p className="text-sm leading-relaxed">O foco fica preso aqui dentro, Esc fecha e o foco volta para o botão que abriu. No celular, o diálogo sobe ancorado na base da tela.</p>
      </Dialog>
      <ConfirmDialog
        trigger={<Button variant="danger-ghost">ConfirmDialog</Button>}
        title="Excluir este registro?"
        description="Esta ação não pode ser desfeita. (Demonstração: nada é apagado.)"
        confirmLabel="Excluir"
        action={kitConfirmAction}
        hidden={{ id: 1 }}
      />
      <Drawer
        trigger={<Button variant="secondary">Abrir Drawer</Button>}
        title="Detalhes da tarefa"
        description="Gaveta lateral para ver ou editar sem sair da lista."
        footer={
          <DialogClose>
            <Button>Concluir</Button>
          </DialogClose>
        }
      >
        <p className="text-sm leading-relaxed">Conteúdo rolável. Use `side=&quot;bottom&quot;` para menus no celular.</p>
      </Drawer>
      <RowMenuDemo />
    </div>
  );
}
