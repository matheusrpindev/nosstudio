import { Inbox } from "lucide-react";
import { StatCard } from "@/components/ui/card";
import { formatDateShort, type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import type { DashboardSummary } from "@/server/dashboard/queries";
import { plural } from "@/server/dashboard/logic";

const urgent = "text-perigo font-bold";

/** Cartões-resumo do topo. Primeiros da tela no celular (uma coluna); no desktop, 3 + 2 em grade de 6. */
export function SummaryCards({ summary, today }: { summary: DashboardSummary; today: ISODate }) {
  const { newLeads, proposals, activeClients, deliveries, receivables } = summary;

  return (
    <section aria-label="Resumo da situação" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
      <StatCard
        className="lg:col-span-2"
        label="Leads novos"
        icon={<Inbox />}
        value={String(newLeads).padStart(2, "0")}
        caption={newLeads === 0 ? "Nenhum pedido esperando resposta." : newLeads === 1 ? "Um pedido esperando o primeiro contato." : "Pedidos esperando o primeiro contato."}
        href="/painel/leads?status=novo"
        tone={newLeads > 0 ? "destaque" : "padrao"}
      />

      <StatCard
        className="lg:col-span-2"
        label="Orçamentos aguardando resposta"
        value={String(proposals.waiting).padStart(2, "0")}
        href="/painel/orcamentos?status=enviada"
        caption={
          proposals.waiting === 0 ? (
            "Nenhum orçamento enviado em aberto."
          ) : proposals.overdue > 0 || proposals.soon > 0 ? (
            <>
              {proposals.overdue > 0 ? <span className={urgent}>{plural(proposals.overdue, "vencido", "vencidos")}</span> : null}
              {proposals.overdue > 0 && proposals.soon > 0 ? " · " : null}
              {proposals.soon > 0 ? <span className="text-grafite font-semibold">{plural(proposals.soon, "vence", "vencem")} em até 3 dias</span> : null}
            </>
          ) : (
            "Nenhum vence nos próximos 3 dias."
          )
        }
      />

      <StatCard
        className="lg:col-span-2"
        label="Clientes ativos"
        value={String(activeClients).padStart(2, "0")}
        caption={activeClients === 0 ? "Nenhum cliente fechado ou em produção." : "Fechados ou em produção."}
        href="/painel/clientes"
      />

      <StatCard
        className="lg:col-span-3"
        label="Entregas pendentes"
        value={String(deliveries.pending).padStart(2, "0")}
        href="/painel/projetos"
        caption={
          deliveries.pending === 0 ? (
            "Nenhum projeto aberto com prazo de entrega."
          ) : deliveries.overdue > 0 ? (
            <>
              <span className={urgent}>{plural(deliveries.overdue, "atrasada", "atrasadas")}</span>
              {deliveries.nextDate ? ` · próxima em ${formatDateShort(deliveries.nextDate)}` : null}
            </>
          ) : deliveries.nextDate ? (
            `Nenhuma atrasada · próxima em ${formatDateShort(deliveries.nextDate)}${deliveries.nextDate === today ? " (hoje)" : ""}`
          ) : (
            "Nenhuma atrasada."
          )
        }
      />

      <StatCard
        className="lg:col-span-3"
        size="md"
        label="Pagamentos a receber"
        value={formatBRL(receivables.totalCents)}
        href="/painel/financeiro"
        caption={
          receivables.count === 0 ? (
            "Nenhum pagamento de cliente pendente."
          ) : (
            <>
              {plural(receivables.count, "lançamento", "lançamentos")}
              {receivables.overdueCount > 0 ? (
                <>
                  {" · "}
                  <span className={urgent}>{formatBRL(receivables.overdueCents)} vencido</span>
                </>
              ) : (
                " · nada vencido"
              )}
            </>
          )
        }
      />
    </section>
  );
}

