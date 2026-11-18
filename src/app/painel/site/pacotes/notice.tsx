import { Alert } from "@/components/ui/alert";

/** Aviso fixo das telas de pacotes. */
export function PricingNotice() {
  return (
    <Alert tone="alerta" title="Antes de publicar valores" className="mb-5">
      Quantidades e valores só devem ser publicados depois de aprovados pelos sócios. <strong>Sob consulta</strong> é o padrão.
    </Alert>
  );
}
