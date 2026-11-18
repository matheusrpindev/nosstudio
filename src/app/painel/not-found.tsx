import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Rota do painel que não existe (ou registro apagado). Aparece dentro do shell. */
export default function PainelNotFound() {
  return (
    <div className="py-6 sm:py-12">
      <EmptyState
        icon={<Compass />}
        title="Não encontramos esta página"
        description="O endereço pode estar errado, o registro pode ter sido excluído — ou esta área do painel ainda não está pronta."
        action={<ButtonLink href="/painel">Voltar para a visão geral</ButtonLink>}
      />
    </div>
  );
}
