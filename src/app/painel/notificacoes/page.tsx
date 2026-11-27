import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { firstParam, parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { requirePanelUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { countNotifications, countUnread, listNotifications } from "@/server/notifications";
import { NotificationRow, NotificationsEmpty } from "./item";
import { MarkAllRead } from "./mark-all";

export const metadata: Metadata = { title: "Notificações" };
export const instant = false;

const PAGE_SIZE = 30;
const PATH = "/painel/notificacoes";

/** Central de notificações: os avisos de quem está logado (cada pessoa só vê os seus). */
export default async function NotificationsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePanelUser();
  const params = await searchParams;
  const unreadOnly = firstParam(params.filtro) === "nao-lidas";
  const page = parsePage(params.pagina);
  const [rows, total, unread] = await Promise.all([
    listNotifications(user.id, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, unreadOnly }),
    countNotifications(user.id, unreadOnly),
    countUnread(user.id),
  ]);
  const now = new Date().getTime();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notificações"
        description="Lembretes dos compromissos em que você é responsável ou participante. Só você vê os seus avisos."
        actions={<MarkAllRead disabled={unread === 0} />}
      />
      <nav aria-label="Filtro das notificações" className="border-borda-forte inline-flex rounded-campo border bg-superficie p-0.5">
        {[
          { href: PATH, label: "Todas", active: !unreadOnly },
          { href: `${PATH}?filtro=nao-lidas`, label: unread > 0 ? `Não lidas (${unread})` : "Não lidas", active: unreadOnly },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn("flex min-h-10 items-center justify-center rounded-[0.5rem] px-4 text-sm font-semibold transition-colors", tab.active ? "bg-detalhe-suave text-detalhe" : "text-texto-suave hover:text-texto")}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <div className="card mt-4">
          <NotificationsEmpty unreadOnly={unreadOnly} />
        </div>
      ) : (
        <ul className="card divide-borda mt-4 divide-y overflow-hidden">
          {rows.map((row) => (
            <li key={row.id} className="pr-1.5">
              <NotificationRow item={{ id: row.id, title: row.title, body: row.body, href: row.href, read: row.readAt !== null, createdAt: row.createdAt.toISOString() }} now={now} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} noun="notificações" className="mt-4" />
    </div>
  );
}
