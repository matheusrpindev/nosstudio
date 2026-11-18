"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Erro inesperado numa página do painel. O shell continua na tela; dá para tentar de novo. */
export default function PainelError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-6 sm:py-12" role="alert">
      <EmptyState
        icon={<TriangleAlert />}
        title="Algo deu errado por aqui"
        description={
          <>
            Não foi possível carregar esta tela. Seus dados continuam salvos — tente de novo em instantes.
            {digest ? <span className="mt-2 block text-xs">Código para o suporte: {digest}</span> : null}
          </>
        }
        action={
          <>
            <Button onClick={() => retry()} icon={<RotateCw />}>
              Tentar de novo
            </Button>
            <ButtonLink href="/painel" variant="secondary">
              Ir para a visão geral
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
