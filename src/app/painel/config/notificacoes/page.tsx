import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireAdmin } from "@/lib/auth";
import { smtpConfigured } from "@/lib/env";
import { listActiveRecipients } from "@/server/config/overview";
import { getSetting } from "@/server/settings";
import { NotificationsForm } from "./form";

export const metadata: Metadata = { title: "Notificações" };
export const instant = false;

export default async function NotificationsPage() {
  await requireAdmin();
  const [settings, activeUsers] = await Promise.all([getSetting("notifications"), listActiveRecipients()]);
  const configured = smtpConfigured();
  const recipients = settings.leadEmails.length > 0 ? settings.leadEmails : activeUsers.map((user) => user.email);

  return (
    <>
      <PageHeader title="Notificações" description="Escolha quando o painel manda e-mail para vocês." back={{ href: "/painel/config", label: "Configurações" }} />

      {configured ? (
        <Alert tone="sucesso" title="Envio de e-mail configurado" className="mb-5">
          O servidor está pronto para enviar os avisos.
        </Alert>
      ) : (
        <Alert tone="alerta" title="O envio de e-mail ainda não está configurado" className="mb-5">
          <p>
            Sem isso, os avisos <strong>não saem por e-mail</strong> e o link de &ldquo;Esqueci minha senha&rdquo; não é enviado (para trocar uma senha, use <em>Usuários → Nova senha</em>). Os leads continuam chegando normalmente no painel.
          </p>
          <p className="mt-1.5">
            Para ligar, quem cuida do servidor precisa preencher no arquivo <code>.env</code> as variáveis <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_SECURE</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> e <code>MAIL_FROM</code> (o remetente) e reiniciar o site. Os dados vêm do provedor de e-mail (por exemplo, o do domínio da NÓS).
          </p>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card flush>
          <CardHeader title="Novo lead" description="Aviso quando alguém envia o formulário do site." />
          <CardSection>
            <NotificationsForm defaults={{ notifyOnLead: settings.notifyOnLead, leadEmails: settings.leadEmails }} />
          </CardSection>
        </Card>

        <Card flush>
          <CardHeader title="Hoje o aviso vai para" />
          <CardSection>
            {!settings.notifyOnLead ? (
              <p className="text-cinza text-sm">Ninguém: o aviso está desligado.</p>
            ) : recipients.length === 0 ? (
              <p className="text-cinza text-sm">Ninguém: não há usuários ativos nem e-mails na lista.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {recipients.map((email) => (
                  <li key={email} className="text-grafite break-all">
                    {email}
                  </li>
                ))}
              </ul>
            )}
            {settings.notifyOnLead && settings.leadEmails.length === 0 ? <p className="hint mt-3">Lista vazia: vale para todos os usuários ativos.</p> : null}
          </CardSection>
        </Card>
      </div>
    </>
  );
}
