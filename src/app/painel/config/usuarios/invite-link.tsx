"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { InviteLinkData } from "@/server/access/invite-actions";

/**
 * O link do convite, mostrado UMA vez logo depois de criar (ou de convidar de novo), com botão de copiar.
 * O painel não guarda o link: se a pessoa perder, é só "Convidar de novo" (gera outro e o anterior para de valer).
 */
export function InviteLinkPanel({ invite, onDone }: { invite: InviteLinkData; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      toast("Link copiado.");
    } catch {
      toast.error("Não consegui copiar. Selecione o link e copie à mão.");
    }
  }

  return (
    <div className="space-y-4">
      {invite.emailed ? (
        <Alert tone="sucesso" title="Convite enviado por e-mail" role="status">
          Mandamos o link para <strong className="break-all">{invite.email}</strong>. Se a pessoa não achar o e-mail, copie o link abaixo e envie você mesmo(a).
        </Alert>
      ) : (
        <Alert tone="alerta" title="Copie o link e envie para a pessoa" role="status">
          O envio de e-mails não está configurado, então o convite <strong>não chegou por e-mail</strong>. Copie o link e mande para <strong className="break-all">{invite.email}</strong> por WhatsApp ou outra conversa privada.
        </Alert>
      )}
      <div className="bg-superficie-alta rounded-campo space-y-1 p-4">
        <p className="text-texto-suave text-xs font-semibold tracking-wide uppercase">Link do convite (vale por 7 dias)</p>
        <output data-testid="link-convite" className="text-texto block font-mono text-sm break-all select-all">
          {invite.link}
        </output>
      </div>
      <p className="text-texto-suave text-sm leading-relaxed">
        Este link só aparece agora. Quem abrir cria a própria senha e passa a ter o acesso do convite — não publique nem encaminhe para outras pessoas.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <Button onClick={onDone}>Concluir</Button>
      </div>
    </div>
  );
}
