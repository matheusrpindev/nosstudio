import { CalendarX2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Compromisso que não existe — ou que não é desta pessoa para abrir/editar (particular de outra pessoa, fora do
 * alcance dela). A resposta é A MESMA nos dois casos, de propósito: a tela não confirma que o compromisso existe.
 *
 * Status HTTP: como em todo o painel, a casca já começou a ser enviada (o layout fica atrás de um <Suspense>)
 * quando a página descobre que não há o que mostrar; o Next mantém 200 e marca a resposta com `noindex`.
 */
export default function AgendaNotFound() {
  return (
    <div className="py-6 sm:py-12">
      <EmptyState
        icon={<CalendarX2 />}
        title="Compromisso não encontrado"
        description="Ele pode ter sido excluído, o endereço pode estar errado — ou é um compromisso que você não pode abrir ou alterar (como um particular de outra pessoa)."
        action={<ButtonLink href="/painel/agenda">Voltar para a agenda</ButtonLink>}
      />
    </div>
  );
}
