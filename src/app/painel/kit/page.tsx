import { CalendarDays, Download, FileText, Inbox, Info, Plus, Send } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge, type BadgeTone } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, CardHeader, CardSection, StatCard } from "@/components/ui/card";
import { DataList } from "@/components/ui/data-list";
import { DescriptionList } from "@/components/ui/description-list";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { ActionForm, Field, FieldRow, FormActions, SubmitButton } from "@/components/ui/form";
import { Checkbox, DateInput, Input, RadioCards, SearchInput, Select, Textarea, TimeInput } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Popover } from "@/components/ui/popover";
import { parsePage, type PageSearchParams } from "@/components/ui/search-params";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { NavTabs, TabPanel, Tabs } from "@/components/ui/tabs";
import { DateText, Money } from "@/components/ui/text";
import { Tooltip } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/auth";
import { PROPOSAL_STATUS_LABELS, type ProposalStatus } from "@/lib/domain";
import { kitDemoAction } from "./actions";
import { LoadingButtonDemo, OverlayDemos, ToastDemo } from "./demos";

export const metadata: Metadata = { title: "Kit de interface" };
export const instant = false;

const PROPOSAL_TONES: Record<ProposalStatus, BadgeTone> = { rascunho: "neutral", enviada: "roxo", aceita: "sucesso", recusada: "perigo", expirada: "alerta" };

type DemoRow = { id: number; client: string; title: string; status: ProposalStatus; total: number; validUntil: string; unread: boolean };
const DEMO_ROWS: DemoRow[] = [
  { id: 12, client: "[Exemplo] Loja Aurora", title: "Pacote mensal de conteúdo", status: "enviada", total: 289000, validUntil: "2026-12-05", unread: true },
  { id: 11, client: "[Exemplo] Juliana e Rafael", title: "Casamento — foto e vídeo", status: "aceita", total: 1090000, validUntil: "2026-11-30", unread: false },
  { id: 10, client: "[Exemplo] Café do Centro", title: "Diária de gravação", status: "rascunho", total: 150000, validUntil: "2026-12-20", unread: false },
  { id: 9, client: "[Exemplo] Studio Vila", title: "Cobertura de evento", status: "expirada", total: 420000, validUntil: "2026-10-01", unread: false },
];
const PAGE_SIZE = 2;

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 border-areia border-t pt-8">
      <h2 id={id} className="text-grafite text-xl font-extrabold tracking-tight">
        {title}
      </h2>
      {description ? <p className="text-cinza mt-1 max-w-2xl text-sm leading-relaxed">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Demo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-cinza mb-2 text-xs font-bold tracking-[0.12em] uppercase">{label}</p>
      {children}
    </div>
  );
}

/** Vitrine dos componentes base (fora do menu). Documentação: src/components/ui/README.md. */
export default async function KitPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();
  const page = Math.min(parsePage((await searchParams).pagina), Math.ceil(DEMO_ROWS.length / PAGE_SIZE));
  const pageRows = DEMO_ROWS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Kit de interface"
        description="Vitrine dos componentes base do painel. A referência de uso está em src/components/ui/README.md; os widgets compostos (quadro, calendário, listas, mídia) ficam na vitrine de widgets."
        badge={<Badge tone="roxo">interno</Badge>}
        actions={
          <ButtonLink href="/painel/kit/widgets" variant="secondary">
            Vitrine de widgets
          </ButtonLink>
        }
      />
      <NavTabs
        aria-label="Vitrines"
        items={[
          { href: "/painel/kit", label: "Componentes base", exact: true },
          { href: "/painel/kit/widgets", label: "Widgets" },
        ]}
        className="mb-8"
      />

      <div className="space-y-10">
        <Section id="kit-acoes" title="Ações" description="Button, ButtonLink e IconButton. Roxo é a ação principal da tela; lima só para um destaque pontual.">
          <Demo label="Variantes">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Primary</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="danger-ghost">Danger ghost</Button>
            </div>
          </Demo>
          <Demo label="Tamanhos, ícones e estados">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Pequeno</Button>
              <Button icon={<Plus />}>Médio com ícone</Button>
              <Button size="lg" iconRight={<Send />}>
                Grande
              </Button>
              <LoadingButtonDemo />
              <Button disabled>Desabilitado</Button>
              <ButtonLink href="/painel/kit" variant="secondary" icon={<FileText />}>
                ButtonLink
              </ButtonLink>
              <Tooltip content="Baixar o PDF da proposta">
                <IconButton aria-label="Baixar PDF" variant="secondary">
                  <Download />
                </IconButton>
              </Tooltip>
              <IconButton aria-label="Agenda" size="sm">
                <CalendarDays />
              </IconButton>
            </div>
          </Demo>
        </Section>

        <Section id="kit-formularios" title="Formulários" description="ActionForm + Field + controles. Envie vazio para ver os erros por campo; digite “erro” no nome para ver o erro geral.">
          <Card className="max-w-2xl">
            <ActionForm action={kitDemoAction}>
              <FieldRow>
                <Field name="nome" label="Nome" required>
                  <Input autoComplete="off" />
                </Field>
                <Field name="email" label="E-mail" optional hint="Só para mostrar o texto de ajuda.">
                  <Input type="email" inputMode="email" autoComplete="off" />
                </Field>
              </FieldRow>
              <Field name="tipo" label="Tipo de cobertura" group required>
                <RadioCards
                  cols={3}
                  options={[
                    { value: "foto", label: "Fotografia", description: "Ensaio ou evento" },
                    { value: "video", label: "Vídeo", description: "Captação e edição" },
                    { value: "ambos", label: "Foto + vídeo", description: "Cobertura completa" },
                  ]}
                />
              </Field>
              <FieldRow cols={3}>
                <Field name="data" label="Data" optional>
                  <DateInput />
                </Field>
                <Field name="horario" label="Horário" optional>
                  <TimeInput />
                </Field>
                <Field name="origem" label="Origem">
                  <Select options={[{ value: "site", label: "Site" }, { value: "whatsapp", label: "WhatsApp" }]} placeholder="Selecione…" />
                </Field>
              </FieldRow>
              <Field name="observacoes" label="Observações" optional hint="Cresce conforme o texto.">
                <Textarea rows={2} />
              </Field>
              <Switch name="publicado" label="Publicado no site" hint="Switch: liga/desliga enviado como checkbox." defaultChecked />
              <Checkbox name="aceite" label="Li e confirmo os dados" hint="Checkbox com erro próprio." />
              <FormActions>
                <SubmitButton pendingLabel="Validando…">Enviar</SubmitButton>
                <Button type="reset" variant="ghost">
                  Limpar
                </Button>
              </FormActions>
            </ActionForm>
          </Card>
          <Demo label="SearchInput (solto)">
            <SearchInput wrapperClassName="max-w-sm" placeholder="Buscar cliente…" label="Buscar cliente" />
          </Demo>
        </Section>

        <Section id="kit-feedback" title="Feedback">
          <Demo label="Alert / Callout">
            <div className="grid gap-3 lg:grid-cols-2">
              <Alert tone="info" title="Informação">
                Pacotes sem valor cadastrado aparecem como “Sob consulta” no site.
              </Alert>
              <Alert tone="sucesso" title="Tudo certo">
                A proposta foi enviada.
              </Alert>
              <Alert tone="alerta" title="Atenção" action={<Button size="sm" variant="secondary">Ver agenda</Button>}>
                Há duas gravações no mesmo dia.
              </Alert>
              <Alert tone="perigo" title="Não foi possível salvar">
                Confira sua conexão e tente de novo.
              </Alert>
            </div>
          </Demo>
          <Demo label="Badge e StatusBadge">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="roxo">Roxo</Badge>
              <Badge tone="lima">Lima</Badge>
              <Badge tone="sucesso">Sucesso</Badge>
              <Badge tone="alerta">Alerta</Badge>
              <Badge tone="perigo">Perigo</Badge>
              <span aria-hidden="true" className="bg-areia mx-1 h-5 w-px" />
              {(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map((status) => (
                <StatusBadge key={status} value={status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_TONES} />
              ))}
            </div>
          </Demo>
          <Demo label="Toasts (toast() + Toaster)">
            <ToastDemo />
          </Demo>
          <div className="grid gap-4 lg:grid-cols-2">
            <Demo label="EmptyState">
              <EmptyState icon={<Inbox />} title="Nenhuma tarefa para hoje" description="Quando houver tarefas com prazo, elas aparecem aqui." action={<Button icon={<Plus />}>Nova tarefa</Button>} />
            </Demo>
            <Demo label="Skeleton e Spinner">
              <Card>
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <SkeletonText className="mt-5" />
                <p className="text-cinza mt-5 flex items-center gap-2 text-sm">
                  <Spinner label="" className="text-roxo" /> Gerando PDF…
                </p>
              </Card>
            </Demo>
          </div>
        </Section>

        <Section id="kit-sobreposicoes" title="Sobreposições" description="Dialog, ConfirmDialog, Drawer, DropdownMenu, Tooltip e Popover (Radix): foco preso, Esc fecha, foco volta ao gatilho.">
          <div className="flex flex-wrap items-center gap-2">
            <OverlayDemos />
            <Popover
              trigger={
                <Button variant="ghost" icon={<Info />}>
                  Popover
                </Button>
              }
            >
              <p className="font-bold">Como calculamos</p>
              <p className="text-cinza mt-1 leading-relaxed">Total = itens inclusos − desconto aprovado. Custos internos nunca aparecem para o cliente.</p>
            </Popover>
          </div>
          <Demo label="Tabs (troca de conteúdo na mesma página)">
            <Card>
              <Tabs
                aria-label="Seções do cliente"
                items={[
                  { value: "dados", label: "Dados" },
                  { value: "historico", label: "Histórico", count: 3 },
                  { value: "arquivos", label: "Arquivos" },
                ]}
              >
                <TabPanel value="dados">
                  <DescriptionList
                    layout="grid"
                    items={[
                      { label: "Cliente", value: "[Exemplo] Loja Aurora" },
                      { label: "Responsável", value: "Laura Nepomuceno" },
                      { label: "Próximo passo", value: "Enviar proposta revisada", wide: true },
                    ]}
                  />
                </TabPanel>
                <TabPanel value="historico">
                  <p className="text-cinza text-sm">Três interações registradas.</p>
                </TabPanel>
                <TabPanel value="arquivos">
                  <p className="text-cinza text-sm">Nenhum arquivo.</p>
                </TabPanel>
              </Tabs>
            </Card>
          </Demo>
        </Section>

        <Section id="kit-dados" title="Dados" description="PageHeader (no topo desta página), Card, StatCard, DataList, DescriptionList, Pagination, FilterBar, Avatar, Money e DateText.">
          <Demo label="StatCard">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Leads novos" value="03" caption="Esperando contato" href="/painel/leads?status=novo" tone="destaque" />
              <StatCard label="Propostas em aberto" value="02" caption="R$ 13.790,00 em negociação" href="/painel/kit" />
              <StatCard label="Entregas previstas" value="04" caption="Nos próximos 7 dias" icon={<CalendarDays />} />
              <StatCard label="Recebido no mês" value={<Money cents={1289000} />} caption="Até hoje" />
            </div>
          </Demo>
          <Demo label="FilterBar + DataList + Pagination (tabela no desktop, cartões no celular)">
            <FilterBar
              search={{ placeholder: "Buscar proposta…", label: "Buscar proposta" }}
              filters={[{ name: "status", label: "Status", options: PROPOSAL_STATUS_LABELS, allLabel: "Todos os status" }]}
            />
            <DataList
              caption="Propostas de exemplo"
              rows={pageRows}
              rowKey={(row) => row.id}
              href={() => "/painel/kit"}
              highlight={(row) => row.unread}
              highlightLabel="Novo"
              columns={[
                {
                  key: "titulo",
                  header: "Proposta",
                  primary: true,
                  cell: (row) => (
                    <>
                      <span className="block">{row.title}</span>
                      <span className="text-cinza block text-[0.8125rem] font-normal">{row.client}</span>
                    </>
                  ),
                },
                { key: "status", header: "Status", cell: (row) => <StatusBadge value={row.status} labels={PROPOSAL_STATUS_LABELS} tones={PROPOSAL_TONES} /> },
                { key: "validade", header: "Válida até", cell: (row) => <DateText value={row.validUntil} /> },
                { key: "total", header: "Total", align: "right", cell: (row) => <Money cents={row.total} className="font-semibold" /> },
              ]}
            />
            <Pagination page={page} pageSize={PAGE_SIZE} total={DEMO_ROWS.length} noun="propostas" />
          </Demo>
          <div className="grid gap-4 lg:grid-cols-2">
            <Demo label="Card + CardHeader + DescriptionList">
              <Card>
                <CardHeader title="Evento" description="Dados do formulário" action={<ButtonLink href="/painel/kit" size="sm" variant="ghost">Editar</ButtonLink>} />
                <DescriptionList
                  items={[
                    { label: "Data", value: <DateText value="2027-03-14" format="long" /> },
                    { label: "Valor", value: <Money cents={1090000} /> },
                    { label: "Saldo", value: <Money cents={-45000} colored /> },
                    { label: "Local", value: null },
                  ]}
                />
              </Card>
            </Demo>
            <Demo label="Card flush + CardSection + Avatar">
              <Card flush>
                <CardHeader title="Equipe" />
                <CardSection className="flex items-center gap-3">
                  <Avatar name="Pedro Henrique" tone="roxo" />
                  <div>
                    <p className="text-sm font-bold">Pedro Henrique</p>
                    <p className="text-cinza text-[0.8125rem]">pedro@nos.local</p>
                  </div>
                </CardSection>
                <CardSection className="flex items-center gap-3">
                  <Avatar name="Laura Nepomuceno" />
                  <div>
                    <p className="text-sm font-bold">Laura Nepomuceno</p>
                    <p className="text-cinza text-[0.8125rem]">laura@nos.local</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1">
                    <Avatar name="Pedro Henrique" size="sm" tone="lima" labelled />
                    <Avatar name="Laura Nepomuceno" size="lg" tone="lavanda" labelled />
                  </span>
                </CardSection>
              </Card>
            </Demo>
          </div>
        </Section>
      </div>
    </>
  );
}
