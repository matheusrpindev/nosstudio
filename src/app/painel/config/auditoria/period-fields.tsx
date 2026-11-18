"use client";

import { useSearchParams } from "next/navigation";

/** Período do filtro (`?de=` e `?ate=`), dentro do `<FilterBar>`: aplica ao escolher a data. */
export function PeriodFields() {
  const params = useSearchParams();
  const from = params.get("de") ?? "";
  const to = params.get("ate") ?? "";
  const apply = (event: React.ChangeEvent<HTMLInputElement>) => event.currentTarget.form?.requestSubmit();
  const active = "border-roxo text-roxo font-semibold";

  // a chave remonta os campos quando a URL muda por fora ("Limpar filtros", voltar do navegador)
  return (
    <div key={`${from}|${to}`} className="grid grid-cols-2 gap-2 md:flex md:items-center">
      <label className="text-cinza flex flex-col gap-1 text-xs font-semibold md:flex-row md:items-center md:gap-2">
        De
        <input type="date" name="de" defaultValue={from} onChange={apply} className={`input md:w-auto ${from ? active : ""}`} />
      </label>
      <label className="text-cinza flex flex-col gap-1 text-xs font-semibold md:flex-row md:items-center md:gap-2">
        Até
        <input type="date" name="ate" defaultValue={to} onChange={apply} className={`input md:w-auto ${to ? active : ""}`} />
      </label>
    </div>
  );
}
