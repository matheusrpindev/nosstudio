"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs as RadixTabs } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const listClasses = "border-borda -mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden";
const tabClasses =
  "text-texto-suave hover:text-detalhe relative inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-3 text-sm font-semibold whitespace-nowrap transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-transparent";
const tabActive = "text-detalhe after:bg-roxo";

function Count({ value }: { value: number }) {
  return <span className="bg-detalhe-suave text-detalhe rounded-full px-1.5 text-xs leading-5 font-bold tabular-nums">{value}</span>;
}

export type TabItem = { value: string; label: ReactNode; count?: number };

export type TabsProps = {
  items: readonly TabItem[];
  defaultValue?: string;
  /** Modo controlado. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Os painéis: um `<TabPanel value="…">` por aba. */
  children: ReactNode;
  "aria-label"?: string;
  className?: string;
};

/** Abas que trocam conteúdo na mesma página (Radix; setas navegam). Para subpáginas de um módulo use `NavTabs`. */
export function Tabs({ items, defaultValue, value, onValueChange, children, className, ...rest }: TabsProps) {
  return (
    <RadixTabs.Root defaultValue={value === undefined ? (defaultValue ?? items[0]?.value) : undefined} value={value} onValueChange={onValueChange} className={className}>
      <RadixTabs.List aria-label={rest["aria-label"]} className={listClasses}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} className={cn(tabClasses, "data-[state=active]:text-detalhe data-[state=active]:after:bg-roxo")}>
            {item.label}
            {item.count !== undefined ? <Count value={item.count} /> : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <RadixTabs.Content value={value} className={cn("pt-5 outline-offset-4", className)}>
      {children}
    </RadixTabs.Content>
  );
}

export type NavTabItem = {
  href: string;
  label: ReactNode;
  count?: number;
  /** Ativa só na rota exata (use na aba "raiz" do módulo, ex.: `/painel/financeiro`). */
  exact?: boolean;
};

/** Abas por link: subnavegação de um módulo (cada aba é uma rota). Rola na horizontal no celular. */
export function NavTabs({ items, className, ...rest }: { items: readonly NavTabItem[]; "aria-label": string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={rest["aria-label"]} className={cn(listClasses, className)}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(tabClasses, active && tabActive)}>
            {item.label}
            {item.count !== undefined ? <Count value={item.count} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
