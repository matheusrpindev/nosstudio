import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActionForm } from "@/components/ui/form";
import { deleteBrandAssetAction, moveBrandAssetAction } from "./actions";

/** Subir, descer, editar e excluir um item da biblioteca (Server Component; só o kit é "use client"). */
export function AssetActions({ id, title, first, last }: { id: number; title: string; first: boolean; last: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <ActionForm action={moveBrandAssetAction} hidden={{ id, direction: "up" }} success="none" hideError className="contents">
        <IconButton type="submit" aria-label={`Subir “${title}”`} disabled={first}>
          <ArrowUp />
        </IconButton>
      </ActionForm>
      <ActionForm action={moveBrandAssetAction} hidden={{ id, direction: "down" }} success="none" hideError className="contents">
        <IconButton type="submit" aria-label={`Descer “${title}”`} disabled={last}>
          <ArrowDown />
        </IconButton>
      </ActionForm>
      <ButtonLink href={`/painel/marca/${id}`} variant="ghost" icon={<Pencil />} aria-label={`Editar “${title}”`}>
        <span className="max-sm:sr-only">Editar</span>
      </ButtonLink>
      <ConfirmDialog
        trigger={
          <Button variant="danger-ghost" icon={<Trash2 />} aria-label={`Excluir “${title}”`}>
            <span className="max-sm:sr-only">Excluir</span>
          </Button>
        }
        title="Excluir este item?"
        description={
          <>
            <strong className="text-grafite">{title}</strong> sai da biblioteca da marca (e o arquivo enviado, se houver, é apagado). Não dá para desfazer.
          </>
        }
        confirmLabel="Excluir item"
        action={deleteBrandAssetAction}
        hidden={{ id }}
      />
    </div>
  );
}
