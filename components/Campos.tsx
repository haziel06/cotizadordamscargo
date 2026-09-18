import * as React from "react";
import { cn } from "@/lib/utils";

/** Controles nativos compactos para tablas editables (estilo hoja de cálculo). */

const base =
  "h-8 w-full rounded border border-input bg-white px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50";

export function Entrada({ className, ...p }: React.ComponentProps<"input">) {
  return <input {...p} className={cn(base, p.type === "number" && "num text-right", className)} />;
}

export function Selector({ className, children, ...p }: React.ComponentProps<"select">) {
  return (
    <select {...p} className={cn(base, "pr-6", className)}>
      {children}
    </select>
  );
}

export function Casilla({ className, ...p }: React.ComponentProps<"input">) {
  return <input type="checkbox" {...p} className={cn("size-4 accent-primary", className)} />;
}

export function Etiqueta({ className, ...p }: React.ComponentProps<"label">) {
  return <label {...p} className={cn("text-xs font-medium text-muted-foreground", className)} />;
}

export function Campo({ etiqueta, children, className }: { etiqueta: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      <Etiqueta>{etiqueta}</Etiqueta>
      {children}
    </div>
  );
}
