import { Alert } from "@/components/ui/alert";

/** Lembrete fixo das telas do portfólio. */
export function RealWorkNotice() {
  return (
    <Alert tone="info" title="Só trabalhos reais e autorizados" className="mb-5">
      Publique apenas projetos que a NÓS Studio realmente fez e que o cliente autorizou mostrar (imagens, vídeo e nome). Na dúvida, deixe como rascunho.
    </Alert>
  );
}
