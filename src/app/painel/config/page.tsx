import { Bell, Database, FileText, History, Users, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canEverywhere, isAdminRole, requirePermission, type CurrentUser } from "@/lib/auth";
import { smtpConfigured } from "@/lib/env";
import { formatPercent } from "@/lib/format";
import { getAuditSummary } from "@/server/config/overview";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Configurações" };
export const instant = false;

/** `allowed` = quem enxerga o cartão (a mesma regra do guarda da página de destino). */
type Area = { href: string; title: string; icon: LucideIcon; description: string; status: string; allowed: (user: CurrentUser) => boolean };

export default async function ConfigPage() {
  const user = await requirePermission("config", "ver");
  const [notifications, proposal, summary] = await Promise.all([getSetting("notifications"), getSetting("proposal"), getAuditSummary()]);

  const areas: Area[] = [
    {
      href: "/painel/config/usuarios",
      title: "Usuários",
      icon: Users,
      description: "Quem entra no sistema: convites, perfis, permissões, senhas e revogação de acessos.",
      status: `${summary.activeUsers} ${summary.activeUsers === 1 ? "conta ativa" : "contas ativas"}`,
      allowed: (who) => canEverywhere(who, "usuarios", "ver"),
    },
    {
      href: "/painel/config/notificacoes",
      title: "Notificações",
      icon: Bell,
      description: "Avisos por e-mail quando chega um lead novo pelo site.",
      status: notifications.notifyOnLead ? (smtpConfigured() ? "Aviso ligado" : "Aviso ligado, mas o e-mail não está configurado") : "Aviso desligado",
      allowed: (who) => isAdminRole(who.role),
    },
    {
      href: "/painel/config/propostas",
      title: "Padrões de proposta",
      icon: FileText,
      description: "Validade, entrada, textos e premissas que já vêm preenchidos em cada orçamento novo.",
      status: `Validade de ${proposal.validityDays} dias · entrada de ${formatPercent(proposal.entryPercent, 0)}`,
      allowed: (who) => canEverywhere(who, "config", "ver"),
    },
    {
      href: "/painel/config/dados",
      title: "Dados e backup",
      icon: Database,
      description: "Exporte tudo em JSON e CSV e saiba como fazer e restaurar backups.",
      status: `${summary.totalRecords.toLocaleString("pt-BR")} registros guardados`,
      allowed: (who) => canEverywhere(who, "dados", "baixar"),
    },
    {
      href: "/painel/config/auditoria",
      title: "Auditoria",
      icon: History,
      description: "O histórico de quem fez o quê no painel, com filtros por pessoa, ação e período.",
      status: `${summary.auditEntries.toLocaleString("pt-BR")} eventos registrados`,
      allowed: (who) => canEverywhere(who, "auditoria", "ver"),
    },
  ];

  const visible = areas.filter((area) => area.allowed(user));

  return (
    <>
      <PageHeader title="Configurações" description="Contas, avisos, padrões dos orçamentos e a guarda dos dados da NÓS." />
      <ul className="grid gap-4 md:grid-cols-2">
        {visible
          .map((area) => (
            <li key={area.href}>
              <Link href={area.href} className="card card-pad hover:border-detalhe/40 focus-visible:outline-foco flex h-full min-h-11 items-start gap-4 transition-colors">
                <span aria-hidden="true" className="bg-detalhe-suave text-detalhe rounded-campo flex size-11 shrink-0 items-center justify-center">
                  <area.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="text-texto block text-base font-bold">{area.title}</span>
                  <span className="text-texto-suave mt-0.5 block text-sm leading-relaxed">{area.description}</span>
                  <span className="text-detalhe mt-2 block text-[0.8125rem] font-semibold">{area.status}</span>
                </span>
              </Link>
            </li>
          ))}
      </ul>
      {visible.length === areas.length ? null : <p className="hint mt-4">Contas, notificações, exportação de dados e auditoria são áreas só de administradores e sócios.</p>}
    </>
  );
}
