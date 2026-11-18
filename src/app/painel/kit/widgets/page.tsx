import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, startOfMonth, todayISO } from "@/lib/dates";
import { MonthCalendar, parseMonthParam, type CalendarItem } from "@/components/ui/month-calendar";
import { BoardDemo, FormDemo, ValidatedFormDemo } from "./demos";

export const metadata: Metadata = { title: "Widgets do kit" };
/** A página lê a sessão a cada requisição: pode bloquear a navegação (o `instant = false` do layout não cobre segmentos filhos). */
export const instant = false;

function Section({ id, title, file, children }: { id: string; title: string; file: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-6">
      <div className="mb-4">
        <h2 id={id} className="text-grafite text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-cinza mt-1 text-sm">
          <code>{file}</code>
        </p>
      </div>
      {children}
    </section>
  );
}

export default async function WidgetsShowcasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const month = parseMonthParam(params.mes, today);

  // Dados fictícios e neutros, sempre em torno de hoje.
  const first = startOfMonth(today);
  const items: CalendarItem[] = [
    { id: 1, date: today, title: "Exemplo: reunião de pauta", time: "09:30", tone: "roxo", href: "#calendario" },
    { id: 2, date: today, title: "Exemplo: entrega de material", time: "16:00", tone: "sucesso" },
    { id: 3, date: addDays(today, 2), title: "Exemplo: gravação externa", time: "08:00", tone: "alerta", href: "#calendario" },
    { id: 4, date: addDays(today, 5), title: "Exemplo: publicação", tone: "lima" },
    { id: 5, date: addDays(first, 9), title: "Exemplo: item 1", time: "10:00", tone: "roxo" },
    { id: 6, date: addDays(first, 9), title: "Exemplo: item 2", time: "11:00", tone: "neutral" },
    { id: 7, date: addDays(first, 9), title: "Exemplo: item 3", time: "14:00", tone: "sucesso" },
    { id: 8, date: addDays(first, 9), title: "Exemplo: item 4", time: "15:30", tone: "perigo" },
    { id: 9, date: addDays(first, 9), title: "Exemplo: item 5 (dia todo)", tone: "lima" },
    { id: 10, date: addDays(first, -2), title: "Exemplo: mês anterior", time: "13:00", tone: "neutral" },
  ];

  return (
    <div className="space-y-14">
      <header>
        <p className="text-roxo text-xs font-bold tracking-widest uppercase">Kit do painel</p>
        <h1 className="text-grafite mt-1 text-3xl font-extrabold tracking-tight">Widgets avançados</h1>
        <p className="text-cinza mt-2 max-w-2xl text-sm leading-relaxed">
          Vitrine dos widgets de <code>src/components/ui</code> com dados fictícios. Referência de uso:{" "}
          <code>src/components/ui/WIDGETS.md</code>. Nada aqui é gravado.
        </p>
      </header>

      <Section id="board" title="Board" file="@/components/ui/board">
        <BoardDemo />
      </Section>

      <Section id="calendario" title="MonthCalendar" file="@/components/ui/month-calendar">
        <MonthCalendar
          month={month}
          today={today}
          items={items}
          baseHref="/painel/kit/widgets"
          label="Calendário de demonstração"
          daySlot={(date) => (
            <Link
              href={`/painel/kit/widgets?mes=${date.slice(0, 7)}&novo=${date}#calendario`}
              className="text-cinza hover:bg-lavanda-claro hover:text-roxo inline-flex size-11 items-center justify-center rounded-md sm:size-7 sm:opacity-0 sm:group-hover/dia:opacity-100 sm:focus-visible:opacity-100"
              aria-label={`Novo item em ${date.slice(8)}/${date.slice(5, 7)}`}
              title="Novo item neste dia"
            >
              <Plus aria-hidden="true" className="size-4" />
            </Link>
          )}
        />
        {typeof params.novo === "string" ? (
          <p className="hint">
            O slot do dia levou a data <code>{params.novo.slice(0, 10)}</code> na URL (parâmetro <code>novo</code>).
          </p>
        ) : null}
      </Section>

      <Section id="formulario" title="Campos de formulário" file="list-fields · markdown-field · masked-inputs · media-fields">
        <div className="card card-pad">
          <FormDemo />
        </div>
      </Section>

      <Section id="validacao" title="Dentro de ActionForm + Field" file="erros da Server Action por campo">
        <div className="card card-pad max-w-3xl">
          <ValidatedFormDemo />
        </div>
      </Section>
    </div>
  );
}
