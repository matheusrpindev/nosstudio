# Kit do painel — `src/components/ui`

Componentes base do painel da NÓS Studio. **Sem arquivo-barril**: importe cada componente pelo seu arquivo
(`@/components/ui/button`, `@/components/ui/form`…). Vitrine viva: **`/painel/kit`** (fora do menu).
Widgets compostos (Board, MonthCalendar, listas editáveis, MarkdownField, mídia, MoneyInput/PhoneInput):
veja [`WIDGETS.md`](./WIDGETS.md) e `/painel/kit/widgets`.

Vocabulário visual: as classes de `src/app/globals.css` (`.btn`, `.input`, `.label`, `.hint`, `.field-error`, `.card`,
`.badge-*`, `.link`). Os componentes embrulham essas classes; use-as direto quando precisar de um elemento nativo
com a mesma cara. Roxo = ação principal; lima = um destaque pontual (nunca texto lima sobre fundo claro).

---

## Receita de um módulo (copie o módulo de Leads)

| Peça | Arquivo de exemplo | O que faz |
| --- | --- | --- |
| Consultas e mutações | `src/server/leads/admin.ts` | Só fala com o banco. Recebe dados já validados, devolve linhas tipadas. `import "server-only"`. |
| Server Actions | `src/app/painel/leads/actions.ts` | `requireUser()` → `parseForm(schema, formData)` → mutação → `logAudit()` → `refresh()`+`actionOk()` **ou** `flashToast()`+`redirect()`. |
| Lista | `src/app/painel/leads/page.tsx` | `PageHeader` + `FilterBar` + `DataList` + `Pagination`; filtros lidos de `searchParams`. |
| Formulário de criação | `src/app/painel/leads/novo/page.tsx` | `ActionForm` + `Field` + controles; a página inteira é Server Component. |
| Detalhe | `src/app/painel/leads/[id]/page.tsx` | `PageHeader` com ações, `Card` + `DescriptionList`, `ConfirmDialog`, `notFound()`. |
| Tons de status | `src/app/painel/leads/ui.ts` | Mapa `status → tom` do módulo (os rótulos vêm de `src/lib/domain.ts`). |
| Menu | `src/app/painel/nav.ts` | Fonte única da navegação. Contadores: `NavBadgeKey` + cálculo em `_shell/shell.tsx`. |

### Página (Server Component)

```tsx
export const metadata: Metadata = { title: "Leads" };   // vira "Leads · Painel NÓS Studio"
export const instant = false;                            // OBRIGATÓRIO em toda página do painel (ver abaixo)

export default async function LeadsPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireUser();                                   // sempre a primeira linha
  const sp = await searchParams;
  const { rows, total, page, pageSize } = await listLeads({
    status: paramOneOf(LEAD_STATUSES, sp.status),        // a URL é entrada do usuário: valide
    q: paramText(sp.q),
    page: parsePage(sp.pagina),
  });
  return (<> <PageHeader … /> <FilterBar … /> <DataList … /> <Pagination … /> </>);
}
```

- **`export const instant = false` em toda página do painel.** As páginas leem sessão e banco a cada visita; sem essa
  linha o Next (Cache Components) acusa no console do navegador, em desenvolvimento, "uncached data … accessed outside of
  `<Suspense>`" para qualquer página que não esteja direto em `/painel`. (Alternativa: um `loading.tsx` na pasta da página.)
- O layout do painel já tem `<Suspense>`, o shell, o `<Toaster />` e o `loading.tsx` geral. Não crie outro layout com shell.
- Registro inexistente: `notFound()` (mostra `painel/not-found.tsx` dentro do shell).
- "Hoje" é `todayISO()`; nunca `new Date().toISOString()`.
- **Não grave nada ao renderizar uma página (GET).** Para "marcar como lido ao abrir", veja `leads/[id]/mark-read.tsx`
  (um efeito no cliente chama a action).
- O Next mantém a página anterior montada e escondida ao navegar. Em testes Playwright, filtre por visíveis
  (`locator.filter({ visible: true })`) e espere a rede acalmar antes de um screenshot logo após `page.goto`.

### Server Action

```ts
"use server";
const schema = z.object({ id: f.id(), status: z.enum(LEAD_STATUSES, { error: "Selecione um status." }) });

export async function updateLeadStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();                      // 1. autorização
  const parsed = parseForm(schema, formData);            // 2. validação (devolve fieldErrors + values prontos)
  if (!parsed.ok) return parsed.state;
  const lead = await setLeadStatus(parsed.data.id, parsed.data.status);   // 3. mutação (src/server/…)
  if (!lead) return actionError("Este lead não existe mais.");
  await logAudit({ user, action: "status", entity: "lead", entityId: lead.id, summary: "…" });  // 4. auditoria
  refresh();                                             // 5a. fica na tela: atualiza os dados…
  return actionOk("Status atualizado.");                 //     …e o ActionForm mostra o toast
  // 5b. sai da tela:  await flashToast("Lead excluído.");  redirect("/painel/leads");
}
```

- Mudou algo que aparece no site público? Chame também `invalidateSite()` (`@/server/site/cache`).
- Campos prontos para schemas: `f.text`, `f.optionalText`, `f.checkbox`, `f.date`, `f.optionalDate`, `f.optionalTime`,
  `f.money`, `f.optionalMoney`, `f.id`, `f.optionalId`, `f.number`, `f.optionalEmail` (`@/server/action`).
- Nunca coloque dados pessoais no `summary` da auditoria de uma exclusão (LGPD).

---

## Formulários

Tudo em `@/components/ui/form` (Client) + `@/components/ui/input` + `@/components/ui/switch`.

```tsx
<ActionForm action={createLeadAction}>                 {/* a action pode vir direto de um Server Component */}
  <Field name="name" label="Nome" required>
    <Input maxLength={120} />                          {/* id, name, aria-* e valor repopulado vêm do Field */}
  </Field>
  <FieldRow>
    <Field name="source" label="Origem"><Select options={CONTACT_SOURCE_LABELS} defaultValue="whatsapp" /></Field>
    <Field name="eventDate" label="Data" optional><DateInput /></Field>
  </FieldRow>
  <Field name="message" label="Mensagem" optional hint="Resumo da conversa."><Textarea /></Field>
  <FormActions>
    <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
    <ButtonLink href="/painel/leads" variant="ghost">Cancelar</ButtonLink>
  </FormActions>
</ActionForm>
```

| Componente | Props principais | Notas |
| --- | --- | --- |
| `ActionForm` | `action`, `hidden={{ id }}`, `success="toast" \| "inline" \| "none"`, `onSuccess(state)`, `resetOnSuccess`, `hideError` | `useActionState` por dentro. Mostra `state.message` de erro em `role="alert"`, foca o primeiro campo inválido, toast no sucesso. `resetOnSuccess` remonta os campos (formulários de "adicionar"). |
| `Field` | `name`, `label`, `hint`, `required`, `optional`, `group`, `hideLabel`, `error` | Acha o erro em `state.fieldErrors[name]` e repopula com `state.values[name]`. `group` = `<fieldset>`/`<legend>` (RadioCards, grupos de checkbox). |
| `FieldRow` | `cols={2 \| 3}` | Campos lado a lado no desktop, empilhados no celular. |
| `SubmitButton` | props de `Button` + `pendingLabel` | `useFormStatus`: spinner e desabilitado enquanto envia. |
| `FormActions` | — | Linha de botões do fim do formulário. |
| `Input` | props de `<input>` | Fonte ≥ 16px, altura ≥ 44px. |
| `Textarea` | props de `<textarea>`, `autoGrow` (padrão `true`) | Cresce com o texto. |
| `Select` | `options` (lista `{ value, label }` **ou** um mapa de rótulos de `domain.ts`), `placeholder`, `defaultValue` | Nativo. Remonta sozinho quando o valor inicial muda (após salvar/erro). |
| `DateInput` / `TimeInput` | props de `<input>` | Nativos: enviam `YYYY-MM-DD` / `HH:mm`. Schema: `f.date()`, `f.optionalDate()`, `f.optionalTime()`. |
| `Checkbox` | `name`, `label`, `hint`, `defaultChecked` | Rótulo clicável; mostra o próprio erro. Schema: `f.checkbox()`. |
| `Switch` (`ui/switch`) | `name`, `label`, `hint`, `defaultChecked`, `checked`/`onCheckedChange` | Radix. Envia `"on"`. Schema: `f.checkbox()`. |
| `RadioCards` | `options: { value, label, description? }[]`, `defaultValue`, `cols`, `compact` | Use dentro de `<Field group name="…">`. Radios nativos (setas funcionam). |
| `SearchInput` | `name="q"`, `label`, `placeholder` | Busca solta. Em listas, use o `FilterBar`. |

Para um controle próprio dentro de `Field`: `useFieldContext()` (id, name, `invalid`, `describedBy`, `value`).
Fora de um `Field`: `useFieldState(name)` (erro e valor a repopular) e `useActionFormState()` (estado e `pending`).

## Ações — `@/components/ui/button`

| Componente | Props principais | Exemplo |
| --- | --- | --- |
| `Button` | `variant: primary \| accent \| secondary \| ghost \| danger \| danger-ghost`, `size: sm \| md \| lg`, `icon`, `iconRight`, `loading`, `block` | `<Button icon={<Plus />} onClick={…}>Nova tarefa</Button>` (`type="button"` por padrão) |
| `ButtonLink` | as de `Button` + `href`, `external` | `<ButtonLink href="/painel/leads/novo" icon={<Plus />}>Cadastrar lead</ButtonLink>` · `external` abre em nova aba com `rel` seguro · `download` (exportações, PDF de rota): vira `<a>` comum, sem prefetch — o `<Link>` chamaria a rota só de a página abrir |
| `IconButton` | `aria-label` (**obrigatório**), `variant` (padrão `ghost`), `size: sm \| md`, `loading` | `<IconButton aria-label="Excluir item"><Trash2 /></IconButton>` |
| `buttonClasses()` | `{ variant, size, block }` | Para dar cara de botão a outro elemento (`<label>`, `<summary>`). |

## Feedback

| Componente | Arquivo | Props principais | Exemplo |
| --- | --- | --- | --- |
| `toast()` | `ui/toast` | `toast(msg)`, `toast.error(msg)`, `toast.info(msg)` | Só no cliente. `ActionForm` já chama no sucesso. |
| `flashToast()` | `ui/flash` (servidor) | `await flashToast(msg, tone?)` | Toast que aparece **depois de um `redirect()`** numa action. |
| `Toaster` | `ui/toast` | — | Já montado nos layouts do painel e das telas de acesso. |
| `Alert` / `Callout` | `ui/alert` | `tone: info \| sucesso \| alerta \| perigo`, `title`, `action`, `role` | `<Alert tone="alerta" title="Atenção">Duas gravações no mesmo dia.</Alert>` |
| `Badge` | `ui/badge` | `tone: neutral \| roxo \| lima \| sucesso \| alerta \| perigo`, `dot` | `<Badge tone="roxo">interno</Badge>` |
| `StatusBadge` | `ui/badge` | `value`, `labels` (de `domain.ts`), `tones` (mapa do módulo) | `<StatusBadge value={lead.status} labels={LEAD_STATUS_LABELS} tones={LEAD_STATUS_TONES} />` |
| `EmptyState` | `ui/empty-state` | `icon`, `title`, `description`, `action`, `variant: card \| plain` | `<EmptyState icon={<Inbox />} title="Nenhum lead" action={<ButtonLink …/>} />` (`plain` dentro de `DataList`/`Card`) |
| `Skeleton` / `SkeletonText` | `ui/skeleton` | `className` (tamanho) · `lines` | `<Skeleton className="h-8 w-48" />` |
| `Spinner` | `ui/spinner` | `label` (`""` se já há texto ao lado), `className` | `<Spinner label="" className="text-roxo" /> Gerando PDF…` |

## Sobreposições (Radix: foco preso, Esc fecha, foco volta ao gatilho)

| Componente | Arquivo | Props principais |
| --- | --- | --- |
| `Dialog` | `ui/dialog` | `trigger`, `title`, `description`, `footer`, `size: sm \| md \| lg`, `open`/`onOpenChange` |
| `DialogClose` | `ui/dialog` | Envolve um botão que fecha o Dialog/Drawer. `useDialogClose()` devolve a função (ex.: `onSuccess` de um `ActionForm`). |
| `ConfirmDialog` | `ui/dialog` | `trigger`, `title`, `description`, `action`, `hidden`, `confirmLabel`, `tone: danger \| primary`, `open`/`onOpenChange`, `children` (campos extras) |
| `Drawer` (= `Sheet`) | `ui/drawer` | `trigger`, `title`, `description`, `footer`, `side: right \| bottom \| left`, `open`/`onOpenChange`, `hideHeader` |
| `DropdownMenu` | `ui/dropdown-menu` | `trigger`, `align`; filhos: `DropdownMenuItem` (`href` \| `onSelect`, `icon`, `tone="danger"`), `DropdownMenuSeparator`, `DropdownMenuLabel` |
| `Tooltip` | `ui/tooltip` | `content`, `side` — só reforço; nada essencial apenas no tooltip |
| `Popover` / `PopoverClose` | `ui/popover` | `trigger`, `align`, `side`, `aria-label` |
| `Tabs` + `TabPanel` | `ui/tabs` | `items: { value, label, count? }[]`, `defaultValue` (ou `value`/`onValueChange`) |
| `NavTabs` | `ui/tabs` | `items: { href, label, count?, exact? }[]`, `aria-label` — abas por link (subpáginas de um módulo) |

```tsx
// Ação destrutiva ligada direto a uma Server Action (fecha com ok: true; erro aparece dentro do diálogo)
<ConfirmDialog
  trigger={<Button variant="danger-ghost" icon={<Trash2 />}>Excluir lead</Button>}
  title="Excluir este lead?"
  description="Os dados serão apagados e não dá para desfazer."
  confirmLabel="Excluir lead"
  action={deleteLeadAction}
  hidden={{ id: lead.id }}
/>
```

"Excluir" dentro de um `DropdownMenu`: use um Client Component com `ConfirmDialog` **controlado** (`open`/`onOpenChange`)
e `onSelect={() => setOpen(true)}` no item — exemplo em `src/app/painel/kit/demos.tsx` (`RowMenuDemo`).

## Dados

| Componente | Arquivo | Props principais |
| --- | --- | --- |
| `PageHeader` | `ui/page-header` | `title`, `description`, `actions`, `back={{ href, label }}`, `badge` — o `<h1>` de toda página |
| `Card` | `ui/card` | `flush` (sem padding, para compor), `as`, `className` |
| `CardHeader` | `ui/card` | `title`, `description`, `action`, `as: h2 \| h3`, `id` |
| `CardSection` | `ui/card` | Seções com divisória dentro de `<Card flush>` |
| `StatCard` | `ui/card` | `label`, `value`, `caption`, `href`, `icon`, `size: lg \| md` (`md` para dinheiro), `tone: padrao \| destaque` |
| `DataList` | `ui/data-list` | `columns`, `rows`, `rowKey`, `href`, `highlight`, `highlightLabel`, `empty`, `caption` |
| `DescriptionList` | `ui/description-list` | `items: { label, value, wide? }[]`, `layout: rows \| grid`, `hideEmpty` |
| `Pagination` | `ui/pagination` | `page`, `pageSize`, `total`, `noun`, `param="pagina"` |
| `FilterBar` | `ui/filter-bar` | `search={{ placeholder, label }} \| false`, `filters: { name, label, options, allLabel }[]`, `preserve`, `children` |
| `Avatar` | `ui/avatar` | `name`, `size: sm \| md \| lg`, `tone: lavanda \| roxo \| lima`, `labelled` |
| `Money` | `ui/text` | `cents`, `colored`, `fallback` |
| `DateText` | `ui/text` | `value` (`YYYY-MM-DD` ou `Date`), `format: date \| long \| short \| datetime \| relative` |
| `paramOneOf`, `paramText`, `paramId`, `parsePage`, `PageSearchParams` | `ui/search-params` | Leitura segura de `searchParams` |

```tsx
// Tabela no desktop que vira lista de cartões no celular. Server Component: as funções rodam no servidor.
<DataList
  caption="Leads"
  rows={rows}
  rowKey={(lead) => lead.id}
  href={(lead) => `/painel/leads/${lead.id}`}          // a linha inteira vira link
  highlight={(lead) => lead.readAt === null}            // destaque (não lidos)
  columns={[
    { key: "nome", header: "Nome", primary: true, cell: (lead) => lead.name },   // exatamente uma `primary`
    { key: "status", header: "Status", cell: (lead) => <StatusBadge … /> },
    { key: "total", header: "Total", align: "right", cell: (row) => <Money cents={row.totalCents} /> },
    { key: "origem", header: "Origem", hideOnMobile: true, cell: … },
  ]}
  empty={<EmptyState variant="plain" icon={<Inbox />} title="Nenhum lead por enquanto" />}
/>
<Pagination page={page} pageSize={pageSize} total={total} noun="leads" />
```

- Colunas com botões/links próprios: `interactive: true` (ficam clicáveis por cima do link da linha).
- `FilterBar` é um `<form method="get">`: selects aplicam ao mudar, a busca no Enter; a página lê `searchParams`.
  O estado dos filtros vive só na URL. Ao filtrar, a paginação volta para a página 1.

## Acessibilidade e celular (requisitos, não enfeite)

- Alvos de toque ≥ 44px (`.btn`, `.input`, itens de menu já cumprem; `size="sm"` só em áreas densas no desktop).
- Todo controle tem rótulo: `Field` cuida de `label`/`aria-describedby`/`aria-invalid`; `IconButton` exige `aria-label`.
- Não dependa só de cor: `StatusBadge` tem texto; destaques de linha têm texto para leitor de tela (`highlightLabel`).
- Teste em 390px: nada de rolagem horizontal; tabelas são `DataList`; ações do `PageHeader` dividem a largura.
- Conteúdo de `Client Components` não pode receber funções de Server Components (ex.: `DataList` é server; `FilterBar`
  e `Pagination` são client e recebem só dados serializáveis). `<Logo />` é Server Component: passe-o como prop/children.
