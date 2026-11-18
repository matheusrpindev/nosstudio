import { KeyRound, MonitorSmartphone } from "lucide-react";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { DateText } from "@/components/ui/text";
import { requireUser } from "@/lib/auth";
import { getSession } from "@/lib/auth/session";
import { USER_ROLE_LABELS } from "@/lib/domain";
import { endOtherSessionsAction } from "./actions";
import { getAccountDetails, listUserSessions } from "./sessions";

export const metadata: Metadata = { title: "Minha conta" };
// navegação entre páginas irmãs pode bloquear (painel sem cache) — ver "Receita de um módulo" no README do kit
export const instant = false;

export default async function AccountPage() {
  const user = await requireUser();
  const session = await getSession();
  const [details, sessions] = await Promise.all([getAccountDetails(user.id), listUserSessions(user.id, session?.sessionId)]);
  const others = sessions.filter((item) => !item.current).length;

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso ao painel e os aparelhos conectados." />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <Card flush>
          <CardSection className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" tone="roxo" />
            <div className="min-w-0">
              <p className="text-grafite truncate text-lg leading-tight font-bold">{user.name}</p>
              <p className="text-cinza truncate text-sm">{user.email}</p>
            </div>
          </CardSection>
          <CardSection>
            <DescriptionList
              items={[
                { label: "Perfil", value: USER_ROLE_LABELS[user.role] },
                { label: "Último login", value: <DateText value={details?.lastLoginAt} format="datetime" /> },
                { label: "Conta criada em", value: <DateText value={details?.createdAt} /> },
              ]}
            />
            <p className="hint mt-4">
              {user.role === "admin"
                ? "Nome e e-mail das contas são alterados em Configurações › Usuários."
                : "Para mudar o nome ou o e-mail da conta, peça a um administrador."}
            </p>
          </CardSection>
          <CardSection className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-grafite text-sm font-bold">Senha</p>
              <p className="text-cinza text-sm">Trocar a senha desconecta os outros aparelhos.</p>
            </div>
            <ButtonLink href="/painel/conta/senha" variant="secondary" icon={<KeyRound />}>
              Trocar senha
            </ButtonLink>
          </CardSection>
        </Card>

        <Card flush as="section" aria-labelledby="sessoes-titulo">
          <CardHeader id="sessoes-titulo" title="Sessões ativas" description="Aparelhos em que sua conta está conectada agora." />
          <ul className="divide-areia divide-y">
            {sessions.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-6">
                <span aria-hidden="true" className="bg-lavanda-claro text-roxo mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-campo">
                  <MonitorSmartphone className="size-[1.125rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-grafite flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {item.device}
                    {item.current ? <Badge tone="sucesso">Este aparelho</Badge> : null}
                  </p>
                  <p className="text-cinza mt-0.5 text-[0.8125rem] leading-snug">
                    Último acesso em <DateText value={item.lastSeenAt} format="datetime" />
                    {item.ip ? <> · IP {item.ip}</> : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <CardSection className="border-areia border-t">
            {others > 0 ? (
              <ConfirmDialog
                trigger={<Button variant="danger-ghost">Encerrar outras sessões ({others})</Button>}
                title="Encerrar as outras sessões?"
                description="Os outros aparelhos serão desconectados e precisarão entrar de novo. Este aparelho continua conectado."
                confirmLabel="Encerrar sessões"
                action={endOtherSessionsAction}
              />
            ) : (
              <p className="text-cinza text-sm">Só este aparelho está conectado.</p>
            )}
          </CardSection>
        </Card>
      </div>
    </>
  );
}
