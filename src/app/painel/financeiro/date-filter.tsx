"use client";

import { useSearchParams } from "next/navigation";

/** Campo de data para a `FilterBar` (entra na URL como `de`/`ate`): aplica ao escolher a data. */
export function DateFilter({ name, label }: { name: "de" | "ate"; label: string }) {
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm font-semibold text-texto-suave max-md:grid max-md:gap-1">
      <span className="whitespace-nowrap">{label}</span>
      <input
        type="date"
        name={name}
        aria-label={label}
        defaultValue={params.get(name) ?? ""}
        key={params.get(name) ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="input md:w-auto"
      />
    </label>
  );
}
