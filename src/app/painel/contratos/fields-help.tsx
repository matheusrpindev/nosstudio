import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { CONTRACT_FIELDS, findUnfilledFields } from "@/server/contracts/fields";

const tokenClasses = "border-areia text-grafite rounded border bg-white px-1.5 py-0.5 font-mono text-[0.8125rem] break-all";

/** Um campo como aparece no texto: `{{cliente}}`. */
export function FieldToken({ children }: { children: string }) {
  return <code className={tokenClasses}>{children}</code>;
}

/** Lista dos campos automáticos, com uma linha de explicação cada (editor de modelo). */
export function ContractFieldsHelp({ className }: { className?: string }) {
  return (
    <section aria-labelledby="campos-automaticos-titulo" className={cn("bg-offwhite border-areia rounded-campo border p-4", className)}>
      <h2 id="campos-automaticos-titulo" className="text-grafite text-sm font-bold">
        Campos automáticos
      </h2>
      <p className="text-cinza mt-1 text-sm leading-relaxed">
        Escreva o campo entre chaves duplas no texto, como <FieldToken>{"{{cliente}}"}</FieldToken>. Ao criar um contrato com este modelo, cada campo é trocado pelo dado do cliente, da
        proposta ou do projeto escolhidos. Se o dado não estiver cadastrado, o campo continua no texto e a tela do contrato avisa para preencher à mão.
      </p>
      <dl className="mt-3 space-y-2">
        {CONTRACT_FIELDS.map((field) => (
          <div key={field.key} className="sm:flex sm:items-baseline sm:gap-3">
            <dt className="shrink-0 sm:w-52">
              <FieldToken>{`{{${field.key}}}`}</FieldToken>
            </dt>
            <dd className="text-cinza mt-0.5 text-sm sm:mt-0">{field.description}</dd>
          </div>
        ))}
      </dl>
      <p className="text-cinza mt-3 text-[0.8125rem] leading-relaxed">
        Os valores vêm da proposta como o cliente a vê no PDF: custos, margem, notas internas e desconto não aprovado nunca entram no contrato.
      </p>
    </section>
  );
}

/**
 * Aviso de que sobraram campos `{{…}}` no texto do contrato (dado que falta no cadastro ou nome de campo desconhecido).
 * Não renderiza nada quando o texto está completo.
 */
export function UnfilledFieldsAlert({ body, children, className }: { body: string; /** O que fazer para resolver. */ children?: ReactNode; className?: string }) {
  const fields = findUnfilledFields(body);
  if (fields.length === 0) return null;
  const unknown = fields.filter((field) => !field.known);
  return (
    <Alert tone="alerta" className={className} title={fields.length === 1 ? "Falta preencher 1 campo no texto" : `Falta preencher ${fields.length} campos no texto`}>
      <p className="flex flex-wrap items-center gap-1.5">
        {fields.map((field) => (
          <FieldToken key={field.token}>{field.token}</FieldToken>
        ))}
      </p>
      {children ? <p className="mt-1.5">{children}</p> : null}
      {unknown.length > 0 ? (
        <p className="mt-1.5">
          {unknown.length === 1 ? "O campo " : "Os campos "}
          {unknown.map((field) => field.token).join(", ")}
          {unknown.length === 1 ? " não é um campo automático: escreva o texto no lugar dele." : " não são campos automáticos: escreva o texto no lugar deles."}
        </p>
      ) : null}
    </Alert>
  );
}
