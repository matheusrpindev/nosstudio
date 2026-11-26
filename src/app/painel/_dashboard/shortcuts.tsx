import { CalendarPlus, FilePlus2, UserPlus, UserRoundPlus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const SHORTCUTS = [
  { key: "lead", href: "/painel/leads/novo", label: "Novo lead", short: "Novo lead", icon: <UserRoundPlus /> },
  { key: "client", href: "/painel/clientes/novo", label: "Novo cliente", short: "Novo cliente", icon: <UserPlus /> },
  { key: "proposal", href: "/painel/orcamentos/novo", label: "Novo orçamento", short: "Novo orçamento", icon: <FilePlus2 /> },
  { key: "event", href: "/painel/agenda/novo", label: "Novo evento na agenda", short: "Novo evento", icon: <CalendarPlus /> },
] as const;

export type ShortcutKey = (typeof SHORTCUTS)[number]["key"];

const COLUMNS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

/** Atalhos de criação. Só aparecem os que a pessoa pode usar (`allowed`, decidido no servidor); sem nenhum, o bloco some. */
export function Shortcuts({ allowed }: { allowed: Record<ShortcutKey, boolean> }) {
  const items = SHORTCUTS.filter((item) => allowed[item.key]);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="atalhos-titulo">
      <h2 id="atalhos-titulo" className="text-texto-suave text-xs font-bold tracking-[0.14em] uppercase">
        Atalhos
      </h2>
      <ul className={cn("mt-3 grid gap-2 sm:gap-3", items.length === 1 ? "grid-cols-1 sm:max-w-xs" : "grid-cols-2", items.length > 1 && COLUMNS[items.length])}>
        {items.map((item) => (
          <li key={item.href}>
            <ButtonLink href={item.href} variant="secondary" block icon={item.icon} className="h-full text-center" aria-label={item.label}>
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </ButtonLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
