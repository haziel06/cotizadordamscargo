"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Anchor, Boxes, Check, FileCheck2, Package, Plane, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICIOS, servicioCombinado } from "@/lib/etiquetas";
import type { TipoServicio } from "@/lib/supabase/tipos";
import { cn } from "@/lib/utils";
import { DialogoCotizacionIA } from "./DialogoCotizacionIA";

const ICONOS: Record<TipoServicio, React.ComponentType<{ className?: string }>> = {
  maritimo_fcl: Boxes,
  maritimo_lcl: Anchor,
  aereo: Plane,
  courier: Package,
  terrestre: Truck,
  aduanas: FileCheck2,
};
const GRUPOS = ["Marítimo", "Aéreo", "Local"] as const;

/**
 * Paso 1 de una cotización: marcar uno o varios servicios (ej. transporte terrestre + gestión aduanera).
 * El primero marcado es el principal; el resto suma sus secciones y campos.
 */
export function SelectorServicios() {
  const router = useRouter();
  const [marcados, setMarcados] = useState<TipoServicio[]>([]);
  const alternar = (v: TipoServicio) => setMarcados((m) => (m.includes(v) ? m.filter((x) => x !== v) : [...m, v]));
  const continuar = () => router.push(`/cotizaciones/nueva?tipos=${marcados.join(",")}`);
  const combinado = marcados.length ? servicioCombinado(marcados) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <DialogoCotizacionIA />
      </div>
      {GRUPOS.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICIOS.filter((s) => s.grupo === g).map((s) => {
              const Icono = ICONOS[s.valor];
              const on = marcados.includes(s.valor);
              const orden = marcados.indexOf(s.valor) + 1;
              return (
                <button
                  key={s.valor}
                  type="button"
                  onClick={() => alternar(s.valor)}
                  aria-pressed={on}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary hover:bg-primary/5",
                    on && "border-primary bg-primary/5 ring-2 ring-primary/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary", on && "bg-primary text-primary-foreground")}>
                      <Icono className="size-5" />
                    </span>
                    <div>
                      <div className="font-semibold text-primary">{s.texto}</div>
                      <div className="text-xs text-muted-foreground">{s.descripcion}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">Ej.: {s.ejemplo}</div>
                  <span className={cn("absolute right-3 top-3 flex size-6 items-center justify-center rounded-full border text-xs", on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-transparent")}>
                    {on ? (marcados.length > 1 ? orden : <Check className="size-3.5" />) : "·"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-md">
        <div className="text-sm">
          {combinado ? (
            <>
              <span className="font-medium text-primary">{combinado.texto}</span>
              <span className="ml-2 text-xs text-muted-foreground">{combinado.secciones.length} secciones de tarifas</span>
            </>
          ) : (
            <span className="text-muted-foreground">Marca uno o varios servicios. Puedes combinar, por ejemplo, transporte terrestre + gestión aduanera.</span>
          )}
        </div>
        <Button size="lg" className="ml-auto" disabled={!marcados.length} onClick={continuar}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
