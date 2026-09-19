"use client";
import { AlertTriangle, EyeOff } from "lucide-react";
import { formatoMoneda, formatoPorcentaje } from "@/lib/calculo/formato";
import type { Recargos, Totales } from "@/lib/calculo/tipos";
import type { Alerta } from "@/lib/calculo/alertas";
import { cn } from "@/lib/utils";

interface Props {
  totales: Totales;
  alertas: Alerta[];
  tipoCambio: number;
  recargos: Recargos;
  /** Solo el admin ve costo, utilidad y margen. */
  esAdmin: boolean;
}

export function ResumenVivo({ totales: t, alertas, tipoCambio, recargos, esAdmin }: Props) {
  const margenBajo = alertas.some((a) => a.tipo === "margen_bajo");
  const visibles = esAdmin ? alertas : alertas.filter((a) => a.tipo !== "margen_bajo" && a.tipo !== "linea_cero");
  return (
    <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 font-semibold text-primary">Resumen</h2>
        <dl className="space-y-2 text-sm">
          <Fila etiqueta="Flete internacional" valor={formatoMoneda(t.internacional_usd, "USD")} />
          <Fila etiqueta="Gastos locales" valor={formatoMoneda(t.local_gtq, "GTQ")} />
          <Fila etiqueta="Gastos de naviera" valor={formatoMoneda(t.naviera_usd, "USD")} />
          <div className="border-t pt-2">
            <Fila etiqueta="Total general" valor={formatoMoneda(t.total_gtq, "GTQ")} grande />
            <div className="text-right text-xs text-muted-foreground">al tipo de cambio {tipoCambio.toFixed(2)}</div>
          </div>
          {(t.ajenos_gtq > 0 || t.ajenos_usd > 0) && (
            <div className="border-t pt-2">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pagos a terceros (aparte)</div>
              {t.ajenos_usd > 0 && <Fila etiqueta="En dólares" valor={formatoMoneda(t.ajenos_usd, "USD")} />}
              {t.ajenos_gtq > 0 && <Fila etiqueta="En quetzales" valor={formatoMoneda(t.ajenos_gtq, "GTQ")} />}
            </div>
          )}
        </dl>
      </div>

      {esAdmin && <div className="rounded-lg border-2 border-dashed border-ambar bg-ambar/10 p-4">
        <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
          <EyeOff className="size-4" /> INTERNO
        </div>
        <p className="mb-3 text-xs text-amber-900/80">No aparece en el PDF del cliente.</p>
        <dl className="space-y-2 text-sm">
          <Fila etiqueta="Costo total" valor={formatoMoneda(t.costo_total_gtq, "GTQ")} />
          {t.descuento_total_gtq > 0 && (
            <Fila etiqueta="Descuento aplicado" valor={`− ${formatoMoneda(t.descuento_total_gtq, "GTQ")}`} clase="text-amber-700" />
          )}
          <Fila etiqueta="Venta sin IVA" valor={formatoMoneda(t.venta_total_gtq, "GTQ")} />
          <Fila etiqueta="Utilidad" valor={formatoMoneda(t.utilidad_gtq, "GTQ")} clase={t.utilidad_gtq < 0 ? "text-destructive" : "text-verde"} />
          <Fila etiqueta="Margen sobre costo" valor={formatoPorcentaje(t.margen_pct)} grande clase={margenBajo ? "text-amber-700" : "text-verde"} />
        </dl>
        <p className="mt-3 text-[11px] text-amber-900/70">
          Líneas con «Imp.» llevan ISR {recargos.isr_pct}% + no domiciliada {recargos.no_domiciliada_pct}% sobre el costo antes del margen.
        </p>
      </div>}

      {visibles.length > 0 && (
        <ul className="space-y-2">
          {visibles.map((a, i) => (
            <li key={i} className="flex items-start gap-2 rounded border border-ambar bg-ambar/10 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {a.mensaje}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Fila({ etiqueta, valor, grande, clase }: { etiqueta: string; valor: string; grande?: boolean; clase?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className={cn("text-muted-foreground", grande && "font-medium text-foreground")}>{etiqueta}</dt>
      <dd className={cn("num font-medium", grande && "text-lg font-semibold", clase)}>{valor}</dd>
    </div>
  );
}
