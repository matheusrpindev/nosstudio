import { ArrowRight, CalendarDays, FileText, Inbox, MonitorSmartphone, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateLong, formatWeekday, todayISO } from "@/lib/dates";
import { countNewLeads } from "@/server/leads/admin";

export const metadata: Metadata = { title: "Visão geral" };

const SHORTCUTS = [
  { href: "/painel/leads", label: "Leads", text: "Pedidos que chegaram pelo site e contatos cadastrados à mão.", icon: Inbox },
  { href: "/painel/clientes", label: "Clientes", text: "Funil de atendimento, histórico e próximos passos.", icon: Users },
  { href: "/painel/orcamentos", label: "Orçamentos", text: "Monte propostas e gere o PDF com a cara da NÓS.", icon: FileText },
  { href: "/painel/agenda", label: "Agenda", text: "Gravações, eventos, reuniões e entregas.", icon: CalendarDays },
  { href: "/painel/site", label: "Editar site", text: "Textos, pacotes, portfólio e depoimentos do site público.", icon: MonitorSmartphone },
] as const;

/**
 * Visão geral — versão provisória (saudação + atalhos). O dashboard com os números da semana substitui este
 * conteúdo; a moldura (PageHeader/StatCard/atalhos) pode ser reaproveitada.
 */
export default async function PainelHomePage() {
  const user = await requireUser();
  const today = todayISO();
  const newLeads = await countNewLeads();
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <header className="mb-8">
        <p className="text-cinza text-sm font-semibold first-letter:uppercase">
          {formatWeekday(today)}, {formatDateLong(today)}
        </p>
        <h1 className="text-grafite mt-1 text-[1.75rem] leading-tight font-extrabold tracking-tight sm:text-4xl">Olá, {firstName}.</h1>
        <p className="text-cinza mt-2 max-w-xl text-[0.9375rem] leading-relaxed">Esta é a central de operação da NÓS Studio. Comece pelo que chegou de novo.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Leads novos"
          value={String(newLeads).padStart(2, "0")}
          caption={newLeads === 0 ? "Nenhum pedido esperando resposta." : newLeads === 1 ? "Um pedido esperando o primeiro contato." : "Pedidos esperando o primeiro contato."}
          href="/painel/leads?status=novo"
          tone={newLeads > 0 ? "destaque" : "padrao"}
        />
      </div>

      <section aria-labelledby="atalhos-titulo" className="mt-10">
        <h2 id="atalhos-titulo" className="text-cinza text-xs font-bold tracking-[0.14em] uppercase">
          Atalhos
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHORTCUTS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="card group hover:border-roxo/40 flex h-full items-start gap-4 p-4 transition-colors sm:p-5">
                <span aria-hidden="true" className="bg-lavanda-claro text-roxo flex size-10 shrink-0 items-center justify-center rounded-campo">
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-grafite flex items-center gap-1.5 text-[0.9375rem] font-bold">
                    {item.label}
                    <ArrowRight aria-hidden="true" className="text-roxo size-4 opacity-0 transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </span>
                  <span className="text-cinza mt-0.5 block text-sm leading-snug">{item.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
