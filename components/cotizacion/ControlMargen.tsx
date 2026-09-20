"use client";
import { Minus, Plus } from "lucide-react";
import { Entrada } from "@/components/Campos";
import { costoBase, margenDesdeVenta, redondear, ventaUnitariaLista } from "@/lib/calculo/linea";
import type { LineaCalculo, Recargos } from "@/lib/calculo/tipos";
import { formatoMoneda } from "@/lib/calculo/formato";
import { cn } from "@/lib/utils";

interface Props {
  linea: LineaCalculo;
  recargos: Recargos;
  onChange: (cambios: Partial<LineaCalculo>) => void;
  compacto?: boolean;
}

/**
 * Tres campos enlazados: costo proveedor · margen (% y monto) · precio de venta unitario.
 * Cambiar cualquiera recalcula los otros. Fórmula: venta = costo × (1+ISR)(1+no dom.) × (1+margen).
 * - Escribir la venta convierte la línea a "precio fijo" (lo que ganas se muestra igual).
 * - Mover el % o el monto vuelve a margen por porcentaje / monto fijo.
 */
export function ControlMargen({ linea, recargos, onChange, compacto }: Props) {
  const unitaria = ventaUnitariaLista(linea, recargos);
  const base = costoBase(linea, recargos);
  const { pct, monto } = margenDesdeVenta(linea, unitaria, recargos);
  const sinCosto = linea.costo_unitario <= 0;
  const simbolo = linea.moneda === "USD" ? "$" : "Q";

  const setPct = (v: number) => onChange({ tipo_margen: "porcentaje", valor_margen: Math.max(0, redondear(v)) });
  const setMonto = (v: number) => onChange({ tipo_margen: "monto_fijo", valor_margen: Math.max(0, redondear(v)) });
  const setVenta = (v: number) => onChange({ tipo_margen: "precio_fijo", valor_margen: Math.max(0, redondear(v)) });

  return (
    <div className={cn("grid items-end gap-2", compacto ? "grid-cols-[6rem_1fr_6rem_7rem]" : "grid-cols-[7rem_1fr_7rem_8rem]")}>
      <label className="space-y-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Costo prov.</span>
        <Entrada type="number" step="0.01" min={0} value={linea.costo_unitario} className={cn("h-7 text-xs", sinCosto && linea.tipo_margen === "porcentaje" && "border-ambar")}
          onChange={(e) => onChange({ costo_unitario: Number(e.target.value) })} />
        {linea.aplica_recargos && base > 0 && (
          <span className="block text-[10px] text-muted-foreground" title="Costo + ISR + no domiciliada">+imp. {formatoMoneda(redondear(base), linea.moneda)}</span>
        )}
      </label>

      <div className="space-y-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Margen <span className={cn("num font-semibold", pct < 15 ? "text-amber-700" : "text-verde")}>{sinCosto ? "—" : `${pct}%`}</span>
          <span className="num ml-1 text-muted-foreground">({simbolo} {monto.toFixed(2)})</span>
        </span>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded border px-1 text-xs hover:bg-muted" onClick={() => setPct(pct - 5)} title="−5%" disabled={sinCosto}><Minus className="size-3" /></button>
          <input type="range" min={0} max={100} step={1} value={Math.min(100, Math.max(0, pct))} disabled={sinCosto}
            onChange={(e) => setPct(Number(e.target.value))} className="h-1.5 w-full accent-primary" />
          <button type="button" className="rounded border px-1 text-xs hover:bg-muted" onClick={() => setPct(pct + 5)} title="+5%" disabled={sinCosto}><Plus className="size-3" /></button>
        </div>
      </div>

      <label className="space-y-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">% ganancia</span>
        <Entrada type="number" step="0.5" min={0} value={linea.tipo_margen === "porcentaje" ? linea.valor_margen : pct} className="h-7 text-xs"
          onChange={(e) => setPct(Number(e.target.value))} disabled={sinCosto} />
      </label>

      <label className="space-y-0.5">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Venta unit.</span>
        <Entrada type="number" step="0.01" min={0} value={unitaria} className="h-7 text-xs font-semibold"
          onChange={(e) => setVenta(Number(e.target.value))} />
      </label>

      {!compacto && (
        <div className="col-span-4 -mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Ganar monto fijo:</span>
          <Entrada type="number" step="0.01" min={0} value={linea.tipo_margen === "monto_fijo" ? linea.valor_margen : monto} className="h-6 w-20 text-[11px]"
            onChange={(e) => setMonto(Number(e.target.value))} />
          <span>{simbolo} por unidad</span>
          <span className="ml-auto">
            {linea.tipo_margen === "precio_fijo" ? "Precio fijo escrito a mano" : linea.tipo_margen === "monto_fijo" ? "Margen en monto fijo" : "Margen en porcentaje"}
          </span>
        </div>
      )}
    </div>
  );
}
