import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { VIEW_LABELS, VIEWS, type ContentView } from "./ui";

/** Alterna entre Calendário, Quadro e Lista preservando os filtros (links, sem JavaScript). */
export function ViewSwitch({ current, query }: { current: ContentView; query: URLSearchParams }) {
  return (
    <nav aria-label="Modo de visualização" className="mb-4 grid grid-cols-3 gap-2 sm:inline-grid sm:grid-cols-[repeat(3,auto)]">
      {VIEWS.map((view) => {
        const params = new URLSearchParams(query);
        if (view !== "lista") params.delete("data");
        if (view === "quadro") params.delete("status");
        params.set("vista", view);
        return (
          <Link
            key={view}
            href={`/painel/conteudo?${params}`}
            aria-current={view === current ? "page" : undefined}
            className={cn(buttonClasses({ variant: view === current ? "primary" : "secondary" }), "justify-center")}
          >
            {VIEW_LABELS[view]}
          </Link>
        );
      })}
    </nav>
  );
}
