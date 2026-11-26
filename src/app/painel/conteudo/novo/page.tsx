import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam, paramId, type PageSearchParams } from "@/components/ui/search-params";
import { requirePermission } from "@/lib/auth";
import { isISODate } from "@/lib/dates";
import { getClientOptions, getUserOptions } from "@/server/options";
import { createContentAction } from "../actions";
import { ContentForm } from "../content-form";

export const metadata: Metadata = { title: "Novo conteúdo" };
export const instant = false;

export default async function NewContentPage({ searchParams }: { searchParams: PageSearchParams }) {
  const user = await requirePermission("conteudo", "editar");
  const params = await searchParams;
  const dateParam = firstParam(params.data);
  const publishDate = dateParam && isISODate(dateParam) ? dateParam : null;
  const [clients, users] = await Promise.all([getClientOptions(), getUserOptions()]);
  const clientParam = paramId(params.cliente);
  const clientId = clients.some((c) => c.value === clientParam) ? (clientParam ?? null) : null;
  const back = publishDate ? `/painel/conteudo?vista=calendario&mes=${publishDate.slice(0, 7)}` : "/painel/conteudo";

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Novo conteúdo"
        description="Registre a ideia agora e complete roteiro, legenda e datas depois. Sem data de publicação, o item fica na lista de ideias."
        back={{ href: back, label: "Conteúdo" }}
      />
      <Card>
        <ContentForm
          action={createContentAction}
          values={{
            title: "",
            clientId,
            network: "instagram",
            format: "reels",
            status: "ideia",
            ideaNotes: "",
            script: "",
            caption: "",
            cta: "",
            recordDate: null,
            editDeadline: null,
            publishDate,
            approvalStatus: "pendente",
            ownerId: user.id,
            assetUrl: "",
            notes: "",
          }}
          clients={clients}
          users={users}
          submitLabel="Criar conteúdo"
          cancelHref={back}
        />
      </Card>
    </div>
  );
}
