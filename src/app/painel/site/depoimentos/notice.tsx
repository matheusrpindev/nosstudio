import { Alert } from "@/components/ui/alert";

/** Lembrete fixo das telas de depoimentos. */
export function AuthorizationNotice() {
  return (
    <Alert tone="info" title="Só depoimentos reais e autorizados" className="mb-5">
      Publique apenas o que um cliente realmente disse e autorizou mostrar (nome, imagem e texto). Sem a autorização registrada, o depoimento não pode ser publicado.
    </Alert>
  );
}
