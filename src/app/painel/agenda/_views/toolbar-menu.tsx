"use client";

import { CalendarArrowDown, EllipsisVertical, Printer, Settings } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type Props = {
  /** Links de exportação (.ics) — ausentes para quem não pode baixar a agenda. */
  exportHrefs: { screen: string; year: string } | null;
  /** Configurações da agenda (categorias, agendas, modelos) — só para quem tem o módulo inteiro. */
  configHref: string | null;
};

/** "Mais ações" da agenda: imprimir a visão atual, exportar .ics e configurar. */
export function ToolbarMenu({ exportHrefs, configHref }: Props) {
  // um link comum de download: o <Link> do Next chamaria a rota só de o menu abrir (prefetch)
  const download = (href: string) => window.location.assign(href);
  return (
    <DropdownMenu
      trigger={
        <IconButton aria-label="Mais ações da agenda" title="Imprimir, exportar e configurar">
          <EllipsisVertical />
        </IconButton>
      }
    >
      <DropdownMenuItem icon={<Printer />} onSelect={() => window.setTimeout(() => window.print(), 50)}>
        Imprimir esta visão
      </DropdownMenuItem>
      {exportHrefs ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Exportar (.ics)</DropdownMenuLabel>
          <DropdownMenuItem icon={<CalendarArrowDown />} onSelect={() => download(exportHrefs.screen)}>
            Período na tela
          </DropdownMenuItem>
          <DropdownMenuItem icon={<CalendarArrowDown />} onSelect={() => download(exportHrefs.year)}>
            Próximos 12 meses
          </DropdownMenuItem>
        </>
      ) : null}
      {configHref ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Settings />} href={configHref}>
            Configurar a agenda
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenu>
  );
}
