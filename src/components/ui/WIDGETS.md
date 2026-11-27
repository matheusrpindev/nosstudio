# Widgets avançados do kit do painel

Vitrine ao vivo: `/painel/kit/widgets` (código de exemplo em `src/app/painel/kit/widgets/`).
Sem arquivo-barril: importe cada widget pelo seu arquivo.

| Widget | Arquivo | Tipo | Valor no servidor |
| --- | --- | --- | --- |
| `Board` | `board.tsx` | Client | Server Action `onMove(cardId, toColumnId)` |
| `MonthCalendar`, `parseMonthParam` | `month-calendar.tsx` | Server ou Client | navegação por `?mes=YYYY-MM` |
| `StringListField`, `ObjectListField` | `list-fields.tsx` | Client | `jsonField(formData, name)` |
| `MarkdownField` | `markdown-field.tsx` | Client | texto (`f.text()` / `f.optionalText()`) |
| `MoneyInput`, `PhoneInput` | `masked-inputs.tsx` | Client | texto (`f.money()` / `f.optionalMoney()`; telefone é string) |
| `ImageField`, `GalleryField`, `FileField` | `media-fields.tsx` | Client | id (`f.optionalId()`) / JSON de ids |

Regras gerais

- **Erros**: todos os campos aceitam `error`; dentro de um `<ActionForm>` (`form.tsx`) o erro `fieldErrors[name]`
  aparece sozinho. `MoneyInput`/`PhoneInput` vão dentro de um `<Field>` e recebem dele id/name/required/aria.
  Os demais (listas, markdown, upload) já trazem o próprio rótulo: **não** os envolva em `<Field>`.
- **Estado**: os campos guardam o valor em estado próprio; `defaultValue` só vale na montagem. Para recarregar
  depois de salvar, use `resetOnSuccess` do `<ActionForm>` ou mude a `key`.
- **Props que são funções** (`renderCard`, `renderItem`, `createItem`, `itemLabel`, `onChange`) só podem ser passadas
  a partir de um Client Component. Server Actions (`onMove`) podem vir de qualquer lugar.
- Tons (`tone`): `"neutral" | "roxo" | "lima" | "sucesso" | "alerta" | "perigo"` — os mesmos das classes `.badge-*`.

---

## Board — `@/components/ui/board`

Kanban genérico. Move por arrastar (mouse; toque com pressão longa; teclado pela alça: espaço, ← →, espaço) e pelo
seletor "Mover para…" de cada cartão. Atualização otimista: se `onMove` devolver `ok: false` (ou falhar), o cartão volta
e a `message` aparece acima do quadro. No celular as colunas rolam na horizontal com snap e há atalhos por coluna.

| Prop | Tipo | |
| --- | --- | --- |
| `columns` | `{ id: string; title: string; tone? }[]` | ordem = ordem das colunas |
| `cards` | `C[]` com `{ id: number; columnId: string; label?: string; content?: ReactNode }` | `label` = nome para leitor de tela (ex.: nome do cliente) |
| `renderCard` | `(card: C) => ReactNode` | miolo do cartão; se omitido, usa `card.content` |
| `onMove` | `(cardId: number, toColumnId: string) => Promise<ActionState>` | Server Action |
| `emptyLabel` | `string` | texto da coluna vazia |
| `label` | `string` | nome acessível do quadro |

```tsx
// clientes/funil.tsx — "use client"
<Board
  label="Funil de clientes"
  columns={CLIENT_STATUSES.map((status) => ({ id: status, title: CLIENT_STATUS_LABELS[status] }))}
  cards={clients.map((c) => ({ ...c, columnId: c.status, label: c.name }))}
  renderCard={(c) => <Link href={`/painel/clientes/${c.id}`} className="font-semibold">{c.name}</Link>}
  onMove={moveClientAction}
/>
```

```ts
// actions.ts — "use server"
export async function moveClientAction(cardId: number, toColumnId: string): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseInput(z.object({ id: f.id(), status: z.enum(CLIENT_STATUSES) }), { id: cardId, status: toColumnId });
  if (!parsed.ok) return parsed.state; // a mensagem aparece acima do quadro e o cartão volta
  await db.update(clients).set({ status: parsed.data.status }).where(eq(clients.id, parsed.data.id));
  await logAudit({ user, action: "update", entity: "client", entityId: parsed.data.id, summary: "Mudou a etapa do funil" });
  refresh(); // os cartões chegam de novo por props e o quadro ressincroniza
  return actionOk();
}
```

Sem wrapper de cliente: numa página (Server Component) passe o miolo pronto em `content` e omita `renderCard`:
`cards={rows.map((r) => ({ id: r.id, columnId: r.status, label: r.title, content: <ItemCard item={r} /> }))}`.
Links, botões e campos dentro do cartão continuam clicáveis (não iniciam arraste). Cartão recém-movido fica no topo
da coluna até os dados novos chegarem.

---

## MonthCalendar — `@/components/ui/month-calendar`

Grade domingo→sábado, sem estado (não tem `"use client"`). Abaixo de 640px vira lista por dia (dias com itens + hoje).

| Prop | Tipo | |
| --- | --- | --- |
| `month` | `YYYY-MM-01` | use `parseMonthParam(params.mes, today)` |
| `today` | `YYYY-MM-DD` | `todayISO()` depois de `await requireUser()` |
| `items` | `{ id; date: "YYYY-MM-DD"; title; time?: "HH:mm" \| null; tone?; href? }[]` | com `href` o item vira link; sem horário vem primeiro |
| `baseHref` | `string` | caminho da página; pode já ter query (`/painel/conteudo?vista=calendario`) |
| `param` | `string` (padrão `"mes"`) | nome do parâmetro de mês |
| `maxPerDay` | `number` (padrão 3) | o excedente fica num "+N" que expande |
| `daySlot` | `(date) => ReactNode` | extra por dia (ex.: link "novo" com a data) |
| `label` | `string` | nome acessível |

```tsx
// conteudo/page.tsx (visão "Calendário") — quem usa este widget hoje é o calendário editorial
export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePermission("conteudo", "ver");
  const today = todayISO();
  const month = parseMonthParam((await searchParams).mes, today);
  const { entries } = await listCalendar({}, addDays(month, -7), addDays(endOfMonth(month), 7)); // a grade mostra dias vizinhos
  return (
    <MonthCalendar month={month} today={today} baseHref="/painel/conteudo?vista=calendario" label="Calendário editorial"
      items={entries.map((e) => ({ id: e.key, date: e.date, title: e.title, tone: "roxo", href: `/painel/conteudo/${e.id}` }))}
      daySlot={(date) => <Link href={`/painel/conteudo/novo?data=${date}`} aria-label={`Novo conteúdo em ${formatDate(date)}`}>+</Link>}
    />
  );
}
```

**A Agenda do painel não usa mais este widget.** Ela tem visões próprias (dia, semana, mês, ano, lista) em
`src/app/painel/agenda/_views`, alimentadas por `listAgenda(user, de, até, filtros)` de `@/server/agenda/queries`, que
expande as repetições e mascara compromissos particulares ("Ocupado"). Não monte um calendário de compromissos lendo
`agenda_events` direto: fora da agenda, use `@/server/agenda-related` (ver `docs/permissoes.md`, seção 6.1) e as
peças `AgendaItemTitle` / `AgendaItemCategory` de `src/app/painel/_shared/agenda-item.tsx`. `MonthCalendar` segue
valendo para calendários simples, de um item por data (calendário editorial).

A célula do dia tem a classe `group/dia` (dá para revelar o slot no hover: `sm:opacity-0 sm:group-hover/dia:opacity-100
sm:focus-visible:opacity-100`). No celular o slot aparece no cabeçalho do dia — dê a ele alvo de 44px (`size-11 sm:size-7`).

---

## StringListField / ObjectListField — `@/components/ui/list-fields`

Listas editáveis com adicionar, editar, remover e reordenar (botões ↑ ↓ com foco preservado). O valor vai em JSON num
`<input type="hidden" name>`.

Props comuns: `name`, `label`, `defaultValue`, `addLabel`, `max?`, `hint?`, `error?`, `emptyLabel?`, `onChange?(itens)`.

**StringListField** — `string[]`. Extras: `placeholder`, `maxLength?`. Enter adiciona; itens vazios são descartados; o
texto digitado e ainda não adicionado também é enviado.

```tsx
<StringListField name="itens" label="O que inclui" defaultValue={service.items} placeholder="Ex.: Roteiro" addLabel="Adicionar" max={12} />
```
```ts
const itens = z.array(f.text(120)).max(12).safeParse(jsonField(formData, "itens") ?? []);
```

**ObjectListField\<T>** — `T[]`. Extras: `createItem: () => T`, `renderItem(item, update, index)`, `itemLabel?(item, index)`
(nome do item para leitor de tela). Em `renderItem`, os inputs **não levam `name`** (use `aria-label`) e chamam
`update({ campo: valor })`.

```tsx
<ObjectListField<{ label: string; quantity: number }>
  name="entregaveis" label="Entregáveis" defaultValue={pkg.deliverables} addLabel="Adicionar entregável"
  createItem={() => ({ label: "", quantity: 1 })} itemLabel={(item) => item.label}
  renderItem={(item, update, i) => (
    <div className="grid grid-cols-[1fr_5.5rem] gap-2">
      <input className="input" aria-label={`Entregável ${i + 1}`} value={item.label} onChange={(e) => update({ label: e.target.value })} />
      <input className="input" type="number" min={0} aria-label={`Quantidade ${i + 1}`} value={item.quantity} onChange={(e) => update({ quantity: Number(e.target.value) || 0 })} />
    </div>
  )}
/>
```
```ts
const schema = z.array(z.object({ label: f.text(120), quantity: z.number().int().min(0) })).max(30);
const parsed = parseInput(z.object({ entregaveis: schema }), { entregaveis: jsonField(formData, "entregaveis") ?? [] });
```

Dinheiro dentro de um item: `<MoneyInput value={item.priceCents} onValueChange={(cents) => update({ priceCents: cents ?? 0 })} />`
(modo controlado, já em centavos — no servidor valide como `z.number().int().min(0)`). Para ids estáveis (checklist),
gere em `createItem`: `{ id: crypto.randomUUID(), text: "", done: false }`. Use `onChange` para totais ao vivo.

---

## MarkdownField — `@/components/ui/markdown-field`

Textarea com barra (negrito Ctrl+B, itálico Ctrl+I, lista, link Ctrl+K), alternância Escrever / Pré-visualizar (mesmo
`<Markdown>` usado na exibição) e dica de formatação. Envia o texto puro em `name`.

Props: `name`, `label`, `defaultValue?`, `rows?` (6), `hint?`, `error?`, `required?`, `optional?`, `placeholder?`,
`maxLength?`, `id?`, `onChange?(texto)`.

```tsx
<MarkdownField name="descricao" label="Descrição" defaultValue={project.description} rows={8} hint="Aparece na página do projeto." />
```
```ts
descricao: f.optionalText(5000)   // exibir: <Markdown>{project.description}</Markdown>
```

---

## MoneyInput / PhoneInput — `@/components/ui/masked-inputs`

Aceitam os atributos de `<input>` (id, name, required, aria-*, className, disabled…).

**MoneyInput** — `defaultValue` em **centavos**; máscara da direita para a esquerda (digitar `1090000` → `10.900,00`),
teclado numérico, prefixo "R$" (`hidePrefix` remove). Envia o **texto** formatado em `name`. Modo controlado:
`value` (centavos) + `onValueChange(cents | null)`.

**PhoneInput** — `defaultValue` com ou sem formatação; máscara `(11) 91234-5678` / `(11) 3456-7890`, `inputMode="tel"`.
Envia o texto formatado. Controlado: `value` + `onValueChange(texto)`.

```tsx
<Field name="valor" label="Valor do pacote" required><MoneyInput defaultValue={pkg.priceCents} /></Field>
<Field name="telefone" label="WhatsApp"><PhoneInput defaultValue={client.phone} /></Field>
```
```ts
valor: f.money(),              // "10.900,00" → 1090000   (opcional: f.optionalMoney() → number | null)
telefone: z.string().trim().refine((v) => v === "" || isValidPhone(v), "Informe um telefone com DDD."),
```

Helpers exportados: `maskMoney(texto)`, `moneyToCents(texto)`, `maskPhone(texto)`.

---

## ImageField / GalleryField / FileField — `@/components/ui/media-fields`

O arquivo sobe para `POST /painel/api/media` assim que é escolhido (ou arrastado), com progresso e erro visíveis; o
formulário guarda só o **id**. Enquanto um envio está em andamento, o submit do formulário é segurado. Remover do campo
só desvincula — nada é apagado no servidor. Texto alternativo é salvo na hora (PATCH) ao sair do campo.

`MediaValue = { id, url, mime, originalName, size, width, height, alt, visibility }` — para `defaultValue`, use
`getMediaValue(id)` / `getMediaValues(ids)` de `@/server/media` na página (Server Component).

| Campo | `defaultValue` | Extras | Hidden `name` | No servidor |
| --- | --- | --- | --- | --- |
| `ImageField` | `MediaValue \| null` | `aspect?` (CSS, ex. `"16/9"`, `"1/1"`, `"4/5"`) | id ou `""` | `f.optionalId()` |
| `GalleryField` | `MediaValue[]` | `max?` | JSON `[id, id…]` na ordem | `jsonField` + `z.array(z.number().int().positive())` |
| `FileField` | `MediaValue \| null` | `accept?` | id ou `""` | `f.optionalId()` |
| `VideoField` | `MediaValue \| null` | — | id ou `""` | `f.optionalId()` |

Comuns: `name`, `label`, `hint?`, `error?`, `onChange?`. Imagens são **públicas** (JPG, PNG, WebP, AVIF ou GIF até
15 MB; viram WebP). `FileField` envia como **privado** (PDF, Office, zip, txt/csv, imagens; até 25 MB) e mostra nome,
tamanho e link para abrir (`url?inline=1` para PDF/imagem), que só funciona com sessão. `VideoField` envia um
**vídeo curto público** (MP4 ou WebM até 30 MB, conferido pelos bytes no servidor e guardado sem reencodar; hoje, o
fundo dos banners). `ImageField` aceita `altField={false}` para esconder o campo de texto alternativo quando o
formulário em volta já tem o seu.

```tsx
// página (server)
const [cover, gallery, contract] = await Promise.all([getMediaValue(p.coverId), getMediaValues(p.galleryIds), getMediaValue(p.contractId)]);
// formulário (client)
<ImageField name="capa" label="Capa" defaultValue={cover} aspect="4/5" />
<GalleryField name="galeria" label="Galeria" defaultValue={gallery} max={12} />
<FileField name="contrato" label="Contrato assinado" defaultValue={contract} accept=".pdf" />
```
```ts
const schema = z.object({ capa: f.optionalId(), contrato: f.optionalId(), galeria: z.array(z.number().int().positive()).max(12) });
const parsed = parseInput(schema, { capa: formData.get("capa"), contrato: formData.get("contrato"), galeria: jsonField(formData, "galeria") ?? [] });
```

Também exportados: `uploadMedia(file, { visibility, alt?, onProgress? })`, `saveMediaAlt(id, alt)`, `formatBytes(n)`.
