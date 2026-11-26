import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { StatCard } from "@/components/ui/card";
import { formatDateShort, type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import type { DashboardSummary } from "@/server/dashboard/queries";
import { plural } from "@/server/dashboard/logic";

const urgent = "text-perigo font-bold";

/** Largura de cada cartão (grade de 6 colunas no desktop) conforme quantos a pessoa pode ver: 5 = 3 + 2. */
const SPANS: Record<number, string[]> = {
  1: ["lg:col-span-6"],
  2: ["lg:col-span-3", "lg:col-span-3"],
  3: ["lg:col-span-2", "lg:col-span-2", "lg:col-span-2"],
  4: ["lg:col-span-3", "lg:col-span-3", "lg:col-span-3", "lg:col-span-3"],
  5: ["lg:col-span-2", "lg:col-span-2", "lg:col-span-2", "lg:col-span-3", "lg:col-span-3"],
};

/**
 * Cartões-resumo do topo. Primeiros da tela no celular (uma coluna); no desktop, grade de 6 (3 + 2 com os cinco).
 * Cada cartão só existe para quem pode ver o módulo dele: o servidor manda `null` (e nem consulta) para os demais.
 */
export function SummaryCards({ summary, today }: { summary: DashboardSummary; today: ISODate }) {
  const { newLeads, proposals, activeClients, deliveries, receivables } = summary;
  const cards: ((className: string) => ReactNode)[] = [];

  if (newLeads !== null) {
    cards.push((className) => (
      <StatCard
        key="leads"
        className={className}
        label="Leads novos"
        icon={<Inbox />}
        value={String(newLeads).padStart(2, "0")}
        caption={newLeads === 0 ? "Nenhum pedido esperando resposta." : newLeads === 1 ? "Um pedido esperando o primeiro contato." : "Pedidos esperando o primeiro contato."}
        href="/painel/leads?status=novo"
        tone={newLeads > 0 ? "destaque" : "padrao"}
      />
    ));
  }

  if (proposals) {
    cards.push((className) => (
      <StatCard
        key="orcamentos"
        className={className}
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
              {proposals.soon > 0 ? <span className="text-texto font-semibold">{plural(proposals.soon, "vence", "vencem")} em até 3 dias</span> : null}
            </>
          ) : (
            "Nenhum vence nos próximos 3 dias."
          )
        }
      />
    ));
  }

  if (activeClients !== null) {
    cards.push((className) => (
      <StatCard
        key="clientes"
        className={className}
        label="Clientes ativos"
        value={String(activeClients).padStart(2, "0")}
        caption={activeClients === 0 ? "Nenhum cliente fechado ou em produção." : "Fechados ou em produção."}
        href="/painel/clientes"
      />
    ));
  }

  if (deliveries) {
    cards.push((className) => (
      <StatCard
        key="entregas"
        className={className}
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
    ));
  }

  if (receivables) {
    cards.push((className) => (
      <StatCard
        key="receber"
        className={className}
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
    ));
  }

  if (cards.length === 0) return null;
  const spans = SPANS[cards.length] ?? [];
  return (
    <section aria-label="Resumo da situação" className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-6">
      {cards.map((render, index) => render(spans[index] ?? "lg:col-span-2"))}
    </section>
  );
}
