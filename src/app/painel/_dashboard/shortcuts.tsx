import { CalendarPlus, FilePlus2, UserPlus, UserRoundPlus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

const SHORTCUTS = [
  { href: "/painel/leads/novo", label: "Novo lead", short: "Novo lead", icon: <UserRoundPlus /> },
  { href: "/painel/clientes/novo", label: "Novo cliente", short: "Novo cliente", icon: <UserPlus /> },
  { href: "/painel/orcamentos/novo", label: "Novo orçamento", short: "Novo orçamento", icon: <FilePlus2 /> },
  { href: "/painel/agenda/novo", label: "Novo evento na agenda", short: "Novo evento", icon: <CalendarPlus /> },
];

export function Shortcuts() {
  return (
    <section aria-labelledby="atalhos-titulo">
      <h2 id="atalhos-titulo" className="text-texto-suave text-xs font-bold tracking-[0.14em] uppercase">
        Atalhos
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {SHORTCUTS.map((item) => (
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
