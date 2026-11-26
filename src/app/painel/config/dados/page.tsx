import { Download, FileSpreadsheet, FileJson, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader, CardSection } from "@/components/ui/card";
import { DataList, type DataListColumn } from "@/components/ui/data-list";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermission } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { countRecords } from "@/server/config/data";
import { TABLE_LABELS } from "./labels";

export const metadata: Metadata = { title: "Dados e backup" };
export const instant = false;

const CSVS = [
  { kind: "clientes", label: "Clientes" },
  { kind: "leads", label: "Leads" },
  { kind: "financeiro", label: "Lançamentos financeiros" },
] as const;

type Row = { name: string; total: number };

const columns: DataListColumn<Row>[] = [
  { key: "tabela", header: "Informação", primary: true, cell: (row) => TABLE_LABELS[row.name] ?? row.name },
  { key: "total", header: "Registros", align: "right", cell: (row) => <span className="tabular-nums">{formatNumber(row.total)}</span> },
];

export default async function DataPage() {
  await requirePermission("dados", "baixar");
  const counts = await countRecords();
  const total = counts.reduce((sum, row) => sum + row.total, 0);

  return (
    <>
      <PageHeader title="Dados e backup" description="Os dados do painel pertencem à NÓS. Aqui vocês levam uma cópia quando quiserem." back={{ href: "/painel/config", label: "Configurações" }} />

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card flush as="section" aria-labelledby="exportar-titulo">
            <CardHeader id="exportar-titulo" title="Exportar" description="Cada download fica registrado na auditoria." />
            <CardSection className="space-y-3">
              <div>
                <p className="text-texto text-sm font-bold">Cópia completa (JSON)</p>
                <p className="text-texto-suave mb-2 text-sm">Todas as informações do painel em um único arquivo, em formato aberto. Serve para guardar ou levar para outro sistema.</p>
                <ButtonLink href="/painel/config/dados/exportar" download icon={<FileJson />} prefetch={false}>
                  Baixar tudo (JSON)
                </ButtonLink>
              </div>
            </CardSection>
            <CardSection className="space-y-3">
              <div>
                <p className="text-texto text-sm font-bold">Planilhas (CSV)</p>
                <p className="text-texto-suave mb-2 text-sm">Abrem direto no Excel e no Google Planilhas, com acentos corretos.</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {CSVS.map((csv) => (
                    <ButtonLink key={csv.kind} href={`/painel/config/dados/exportar?csv=${csv.kind}`} download variant="secondary" icon={<FileSpreadsheet />} prefetch={false}>
                      {csv.label}
                    </ButtonLink>
                  ))}
                </div>
              </div>
            </CardSection>
            <CardSection>
              <p className="text-texto-suave flex items-start gap-2 text-[0.8125rem] leading-relaxed">
                <ShieldCheck aria-hidden="true" className="text-detalhe mt-0.5 size-4 shrink-0" />
                As exportações trazem dados pessoais de clientes e leads (LGPD): guarde em local seguro. Senhas, sessões de login e tokens nunca são exportados.
              </p>
            </CardSection>
          </Card>

          <Card flush as="section" aria-labelledby="backup-titulo">
            <CardHeader id="backup-titulo" title="Backup e restauração" />
            <CardSection className="space-y-3 text-sm leading-relaxed">
              <p>
                O <strong>backup</strong> é uma cópia completa do banco <em>e</em> dos arquivos enviados (imagens, contratos, comprovantes). A exportação acima não leva os arquivos; o backup leva.
              </p>
              <p>
                Quem cuida do servidor roda <code>npm run backup</code>: gera um arquivo em <code>data/backups</code> e mantém os 14 mais recentes. O ideal é agendar e copiar os arquivos para <strong>fora</strong> do servidor (outro disco ou nuvem).
              </p>
              <p>
                Para <strong>restaurar</strong>: pare o site, rode <code>npm run restore -- data/backups/nos-backup-AAAAMMDD-HHMMSS.tar.gz</code> e inicie o site de novo. Os dados atuais não são apagados: ficam ao lado, com o sufixo <code>.antes-da-restauracao</code>.
              </p>
              <p className="text-texto-suave">Com banco remoto (Turso), o backup do banco é feito pelo provedor; o script guarda só os arquivos enviados.</p>
              <Alert tone="info" title="Os dados são da NÓS">
                Clientes, leads, propostas, contratos e todo o conteúdo pertencem à NÓS Studio e podem ser exportados a qualquer momento, sem depender de ninguém.
              </Alert>
            </CardSection>
          </Card>
        </div>

        <Card flush as="section" aria-labelledby="contagem-titulo">
          <CardHeader id="contagem-titulo" title="O que está guardado" description={`${formatNumber(total)} registros em ${counts.length} tabelas.`} action={<Download aria-hidden="true" className="text-texto-suave size-5" />} />
          <DataList caption="Registros por tabela" columns={columns} rows={counts} rowKey={(row) => row.name} className="rounded-none border-0 shadow-none" />
        </Card>
      </div>
    </>
  );
}
