import { cn } from "@/lib/cn";

/** Bloco cinza pulsante para estados de carregamento. Defina tamanho via className (`h-4 w-32`). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("bg-borda/70 h-4 animate-pulse rounded-md motion-reduce:animate-none", className)} />;
}

/** Várias linhas de texto falso. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}
