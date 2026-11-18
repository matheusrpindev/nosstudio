import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, type AlertTone } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type ISODate } from "@/lib/dates";
import { formatBRL } from "@/lib/format";
import { describeDeadline, plural } from "@/server/dashboard/logic";
import type { DashboardIssues, SetupGaps } from "@/server/dashboard/queries";

type Notice = { key: string; tone: AlertTone; title: string; items: { label: string; href: string; detail?: string }[]; more?: string; action: { href: string; label: string } };

export function buildNotices(issues: DashboardIssues, gaps: SetupGaps, today: ISODate): Notice[] {
  const notices: Notice[] = [];
  const { overdueProposals: p, overdueDeliveries: d, overduePayables: f } = issues;

  if (d.total > 0) {
    notices.push({
      key: "entregas",
      tone: "perigo",
      title: `${plural(d.total, "entrega atrasada", "entregas atrasadas")}`,
      items: d.items.map((r) => ({ label: r.clientName ? `${r.title} · ${r.clientName}` : r.title, href: `/painel/projetos/${r.id}`, detail: describeDeadline(r.deadline, today, "prazo") })),
      more: d.total > d.items.length ? `E mais ${d.total - d.items.length}.` : undefined,
      action: { href: "/painel/projetos", label: "Ver projetos" },
    });
  }
  if (p.total > 0) {
    notices.push({
      key: "orcamentos",
      tone: "alerta",
      title: `${plural(p.total, "orçamento venceu", "orçamentos venceram")} sem resposta`,
      items: p.items.map((r) => ({ label: `${r.number} · ${r.title}${r.clientName ? ` · ${r.clientName}` : ""}`, href: `/painel/orcamentos/${r.id}`, detail: describeDeadline(r.validUntil, today) })),
      more: p.total > p.items.length ? `E mais ${p.total - p.items.length}.` : undefined,
      action: { href: "/painel/orcamentos?status=enviada", label: "Ver orçamentos" },
    });
  }
  if (f.total > 0) {
    notices.push({
      key: "contas",
      tone: "perigo",
      title: `${plural(f.total, "conta a pagar vencida", "contas a pagar vencidas")} (${formatBRL(f.totalCents)})`,
      items: f.items.map((r) => ({
        label: `${r.description}${r.supplier ? ` · ${r.supplier}` : ""} · ${formatBRL(r.amountCents)}`,
        href: `/painel/financeiro/${r.id}`,
        detail: describeDeadline(r.dueDate, today),
      })),
      more: f.total > f.items.length ? `E mais ${f.total - f.items.length}.` : undefined,
      action: { href: "/painel/financeiro", label: "Ver financeiro" },
    });
  }
  return notices;
}

type Gap = { key: string; text: ReactNode; href: string; cta: string };

function setupItems(gaps: SetupGaps): Gap[] {
  const items: Gap[] = [];
  if (gaps.whatsapp) items.push({ key: "whatsapp", text: "WhatsApp do site não preenchido — os botões de WhatsApp ficam escondidos.", href: "/painel/site/textos/general#bloco-whatsapp", cta: "Preencher" });
  if (gaps.email) items.push({ key: "email", text: "E-mail de contato do site não preenchido.", href: "/painel/site/textos/general#bloco-contato", cta: "Preencher" });
  if (gaps.smtp) items.push({ key: "smtp", text: "Envio de e-mail (SMTP) não configurado — avisos e recuperação de senha não saem por e-mail.", href: "/painel/config/notificacoes", cta: "Ver configuração" });
  if (gaps.faq) items.push({ key: "faq", text: "Nenhuma pergunta frequente publicada — o bloco de FAQ não aparece no site.", href: "/painel/site/faq", cta: "Publicar perguntas" });
  return items;
}

export function Notices({ issues, gaps, today }: { issues: DashboardIssues; gaps: SetupGaps; today: ISODate }) {
  const notices = buildNotices(issues, gaps, today);
  const setup = setupItems(gaps);

  if (notices.length === 0 && setup.length === 0) {
    return (
      <section aria-labelledby="avisos-titulo">
        <h2 id="avisos-titulo" className="sr-only">
          Avisos
        </h2>
        <Alert tone="sucesso" title="Tudo em ordem">
          Nenhuma entrega atrasada, orçamento vencido ou conta vencida. O site está com o essencial configurado.
        </Alert>
      </section>
    );
  }

  return (
    <section aria-labelledby="avisos-titulo" className="space-y-3">
      <h2 id="avisos-titulo" className="text-cinza text-xs font-bold tracking-[0.14em] uppercase">
        Avisos
      </h2>
      {notices.map((notice) => (
        <Alert
          key={notice.key}
          tone={notice.tone}
          title={notice.title}
          action={
            <ButtonLink href={notice.action.href} variant="secondary" size="sm">
              {notice.action.label}
            </ButtonLink>
          }
        >
          <ul className="mt-1 space-y-1">
            {notice.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="link break-words">
                  {item.label}
                </Link>
                {item.detail ? <span className="text-cinza"> — {item.detail}</span> : null}
              </li>
            ))}
          </ul>
          {notice.more ? <p className="text-cinza mt-1">{notice.more}</p> : null}
        </Alert>
      ))}
      {setup.length > 0 ? (
        <Card flush as="div">
          <CardHeader as="h3" title="Pendências de configuração" description="Coisas simples que deixam o site e o painel completos." />
          <div className="card-secao">
            <ul className="divide-areia divide-y">
              {setup.map((gap) => (
                <li key={gap.key} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="text-grafite text-sm leading-snug">{gap.text}</span>
                  <ButtonLink href={gap.href} variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto">
                    {gap.cta}
                  </ButtonLink>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
    </section>
  );
}

