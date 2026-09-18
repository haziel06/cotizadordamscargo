"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { TIPOS_MARGEN, UNIDADES } from "@/lib/etiquetas";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda } from "@/lib/calculo/formato";
import type { Recargos } from "@/lib/calculo/tipos";
import type { TarifaRuta, Tarifario } from "@/lib/supabase/tipos";
import { archivarRuta, eliminarRuta, guardarRuta, type DatosRuta } from "@/lib/tarifas/acciones";
import { claveNueva, useFilasEditables, type Fila } from "./useFilasEditables";
import { cn } from "@/lib/utils";

type F = Fila<DatosRuta & { archivado_at?: string | null }>;

const aFila = (r: TarifaRuta): F => ({
  _clave: r.id, id: r.id, tarifario_id: r.tarifario_id, pais: r.pais, origen: r.origen, destino: r.destino, via: r.via,
  costo: r.costo == null ? null : Number(r.costo), unidad: r.unidad, minimo: r.minimo == null ? null : Number(r.minimo),
  transito: r.transito, tipo_margen: r.tipo_margen, valor_margen: Number(r.valor_margen), aplica_recargos: r.aplica_recargos,
  notas: r.notas, archivado_at: r.archivado_at,
});

export function TablaRutas({ tarifario, rutas, recargos }: { tarifario: Tarifario; rutas: TarifaRuta[]; recargos: Recargos }) {
  const router = useRouter();
  const { filas, actualizar, guardar, agregar, quitar } = useFilasEditables<DatosRuta & { archivado_at?: string | null }>(
    rutas.map(aFila), guardarRuta, (f) => f.origen.trim().length > 0,
  );
  const [q, setQ] = useState("");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => (verArchivadas || !f.archivado_at) && (!t || `${f.pais ?? ""} ${f.origen} ${f.via ?? ""}`.toLowerCase().includes(t)));
  }, [filas, q, verArchivadas]);

  const nueva = () =>
    agregar({ _clave: claveNueva(), tarifario_id: tarifario.id, pais: "", origen: "", destino: tarifario.destino ?? "Guatemala", via: "", costo: null, unidad: "cbm", minimo: null, transito: "", tipo_margen: "porcentaje", valor_margen: 20, aplica_recargos: true, notas: "" });

  const archivar = (f: F) => startTransition(async () => { if (f.id) { await archivarRuta(f.id, !f.archivado_at); actualizar(f._clave, { archivado_at: f.archivado_at ? null : new Date().toISOString() }); } });
  const borrar = (f: F) => {
    if (!f.id) return quitar(f._clave);
    if (!confirm(`¿Borrar definitivamente la ruta ${f.origen}?`)) return;
    startTransition(async () => { const r = await eliminarRuta(f.id!); if (r.ok) quitar(f._clave); else alert(r.error); router.refresh(); });
  };

  const venta = (f: F) =>
    f.costo == null ? null : ventaLinea({ nombre: "", categoria: "internacional", moneda: tarifario.moneda, cantidad: 1, costo_unitario: f.costo, tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, lleva_iva: true, aplica_recargos: f.aplica_recargos }, recargos);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-primary">Rutas <span className="text-xs font-normal text-muted-foreground">({visibles.length})</span></h2>
        <Entrada placeholder="Buscar país, puerto o vía…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><Casilla checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Ver archivadas</label>
        <Button size="sm" className="ml-auto" onClick={nueva}><Plus /> Nueva ruta</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">País</th>
              <th className="px-2 py-2 font-medium">Origen</th>
              <th className="px-2 py-2 font-medium">Vía</th>
              <th className="px-2 py-2 text-right font-medium">Costo</th>
              <th className="px-2 py-2 font-medium">Unidad</th>
              <th className="px-2 py-2 text-right font-medium">Mínimo</th>
              <th className="px-2 py-2 font-medium">Tránsito</th>
              <th className="px-2 py-2 font-medium">Margen</th>
              <th className="px-2 py-2 text-right font-medium">Valor</th>
              <th className="px-2 py-2 text-center font-medium" title="Lleva ISR + no domiciliada">Imp.</th>
              <th className="px-2 py-2 text-right font-medium">Venta</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.length === 0 && (
              <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Sin rutas. Agrega la primera o adjunta el tarifario y cárgalas.</td></tr>
            )}
            {visibles.map((f) => {
              const v = venta(f);
              return (
                <tr key={f._clave} className={cn(f.archivado_at && "opacity-50", f.costo == null && "bg-amber-50/60")}>
                  <td className="px-2 py-1"><Entrada value={f.pais ?? ""} onChange={(e) => actualizar(f._clave, { pais: e.target.value })} onBlur={() => guardar(f._clave)} className="w-24" /></td>
                  <td className="px-2 py-1"><Entrada value={f.origen} autoFocus={!f.id} onChange={(e) => actualizar(f._clave, { origen: e.target.value })} onBlur={() => guardar(f._clave)} className="min-w-36" /></td>
                  <td className="px-2 py-1"><Entrada value={f.via ?? ""} onChange={(e) => actualizar(f._clave, { via: e.target.value })} onBlur={() => guardar(f._clave)} className="w-32" /></td>
                  <td className="px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.costo ?? ""} placeholder="falta" onChange={(e) => actualizar(f._clave, { costo: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-24" /></td>
                  <td className="px-2 py-1">
                    <Selector value={f.unidad} onChange={(e) => guardar(f._clave, { unidad: e.target.value as F["unidad"] })} className="w-28">
                      {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.texto}</option>)}
                    </Selector>
                  </td>
                  <td className="px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.minimo ?? ""} onChange={(e) => actualizar(f._clave, { minimo: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="px-2 py-1"><Entrada value={f.transito ?? ""} placeholder="30-35" onChange={(e) => actualizar(f._clave, { transito: e.target.value })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="px-2 py-1">
                    <Selector value={f.tipo_margen} onChange={(e) => guardar(f._clave, { tipo_margen: e.target.value as F["tipo_margen"] })} className="w-32">
                      {TIPOS_MARGEN.map((t) => <option key={t.valor} value={t.valor}>{t.corto}</option>)}
                    </Selector>
                  </td>
                  <td className="px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.valor_margen} onChange={(e) => actualizar(f._clave, { valor_margen: Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="px-2 py-1 text-center"><Casilla checked={f.aplica_recargos} onChange={(e) => guardar(f._clave, { aplica_recargos: e.target.checked })} /></td>
                  <td className="num px-2 py-1 text-right font-medium whitespace-nowrap">{v == null ? <span className="text-amber-700">falta monto</span> : formatoMoneda(v, tarifario.moneda)}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <span className="mr-1 inline-block w-14 text-right text-[11px] text-muted-foreground">{f._estado === "guardando" ? "…" : f._estado === "guardado" ? "Guardado" : f._error ?? ""}</span>
                    <Button variant="ghost" size="icon-xs" onClick={() => archivar(f)} title={f.archivado_at ? "Restaurar" : "Archivar"}>{f.archivado_at ? <ArchiveRestore /> : <Archive />}</Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => borrar(f)} title="Borrar definitivamente"><Trash2 /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Venta = costo × (1 + ISR {recargos.isr_pct}%) × (1 + no domiciliada {recargos.no_domiciliada_pct}%) × (1 + margen) cuando la fila lleva impuestos. Se guarda al salir de cada celda.
      </p>
    </section>
  );
}
