import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";

/**
 * Avisa quando a seção inteira está desligada em "Visibilidade das seções" (Textos do site):
 * mesmo com itens publicados, o visitante não vê nada.
 */
export function SectionHiddenNotice({ hidden, section }: { hidden: boolean; section: string }) {
  if (!hidden) return null;
  return (
    <Alert
      tone="alerta"
      title={`${section} está oculto no site`}
      className="mb-5"
      action={
        <ButtonLink href="/painel/site/textos/visibility" variant="secondary" size="sm">
          Mudar visibilidade
        </ButtonLink>
      }
    >
      Mesmo o que estiver publicado aqui não aparece para os visitantes enquanto a seção estiver desligada.
    </Alert>
  );
}
