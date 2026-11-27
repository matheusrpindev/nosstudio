import { Alert } from "@/components/ui/alert";

/** Lembrete fixo das telas do portfólio: as regras dos sócios para o que pode ser publicado. */
export function RealWorkNotice() {
  return (
    <Alert tone="info" title="Só trabalhos reais e autorizados" className="mb-5">
      Publique apenas projetos que realmente foram feitos e que o cliente autorizou mostrar (imagens, vídeo e nome). O nome do cliente só aparece no site se você marcar que ele autorizou. Trabalhos feitos por um dos
      fundadores antes da NÓS entram marcados como experiência anterior. Nada entra aqui sozinho: arquivos de projetos e da equipe nunca vão para o portfólio automaticamente. Na dúvida, deixe como rascunho.
    </Alert>
  );
}
