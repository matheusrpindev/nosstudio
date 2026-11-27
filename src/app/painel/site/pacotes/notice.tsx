import { Alert } from "@/components/ui/alert";

/** Aviso fixo das telas de planos. */
export function PricingNotice() {
  return (
    <Alert tone="alerta" title="Antes de publicar valores" className="mb-5">
      O briefing pede para não publicar preços nem quantidades antes de validar custos, capacidade e margem. Enquanto o valor estiver
      como <strong>Valor oculto</strong>, o site mostra o texto “Investimento personalizado para o seu negócio.” (editável em Textos →
      Página de planos).
    </Alert>
  );
}
