"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { TIPOS_MARGEN, UNIDADES } from "@/lib/etiquetas";
import { costoBase, redondear, ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda } from "@/lib/calculo/formato";
import type { Recargos } from "@/lib/calculo/tipos";
import type { TarifaRuta, Tarifario } from "@/lib/supabase/tipos";
import { archivarRuta, eliminarRuta, guardarRuta, type DatosRuta } from "@/lib/tarifas/acciones";
import { claveNueva, useFilasEditables, type Fila } from "./useFilasEditables";
import { cn } from "@/lib/utils";

type F = Fila<DatosRuta & { archivado_at?: string | null }>;

const aFila = (r: TarifaRuta): F => ({
  _clave: r.id, id: r.id, tarifario_id: r.tarifario_id, pais: r.pais, origen: r.origen, destino: r.destino, via: r.via, variante: r.variante, naviera: r.naviera,
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
  const [margenMasivo, setMargenMasivo] = useState("");
  const [, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => (verArchivadas || !f.archivado_at) && (!t || `${f.pais ?? ""} ${f.origen} ${f.naviera ?? ""} ${f.variante ?? ""} ${f.via ?? ""}`.toLowerCase().includes(t)));
  }, [filas, q, verArchivadas]);

  const nueva = () =>
    agregar({ _clave: claveNueva(), tarifario_id: tarifario.id, pais: "", origen: "", destino: tarifario.destino ?? "Guatemala", via: "", variante: "", naviera: "", costo: null, unidad: "cbm", minimo: null, transito: "", tipo_margen: "porcentaje", valor_margen: 20, aplica_recargos: true, notas: "" });

  const archivar = (f: F) => startTransition(async () => { if (f.id) { await archivarRuta(f.id, !f.archivado_at); actualizar(f._clave, { archivado_at: f.archivado_at ? null : new Date().toISOString() }); } });
  const borrar = (f: F) => {
    if (!f.id) return quitar(f._clave);
    if (!confirm(`¿Borrar definitivamente la ruta ${f.origen}?`)) return;
    startTransition(async () => { const r = await eliminarRuta(f.id!); if (r.ok) quitar(f._clave); else alert(r.error); router.refresh(); });
  };

  const linea = (f: F) => ({ nombre: "", categoria: "internacional" as const, moneda: tarifario.moneda, cantidad: 1, costo_unitario: f.costo ?? 0, tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, lleva_iva: true, aplica_recargos: f.aplica_recargos });
  const venta = (f: F) => (f.costo == null ? null : ventaLinea(linea(f), recargos));
  /** Lo que le cuesta a Dams Cargo antes del margen: el costo del proveedor más ISR y no domiciliada si la fila los lleva. */
  const costoConImpuestos = (f: F) => (f.costo == null ? null : redondear(costoBase(linea(f), recargos)));

  const aplicarMargenMasivo = () => {
    const pct = Number(margenMasivo);
    if (!Number.isFinite(pct) || pct < 0 || pct > 300) return alert("Pon un porcentaje entre 0 y 300.");
    if (!confirm(`¿Poner ${pct}% de margen a las ${visibles.length} rutas que se ven ahora? Cambia el precio de venta de todas ellas.`)) return;
    for (const f of visibles) if (f.id) guardar(f._clave, { tipo_margen: "porcentaje", valor_margen: pct });
    setMargenMasivo("");
  };

  const grupo = "px-2 py-1 text-center text-[11px] font-semibold tracking-wide uppercase";
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-primary">Rutas <span className="text-xs font-normal text-muted-foreground">({visibles.length})</span></h2>
        <Entrada placeholder="Buscar puerto, país, naviera…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><Casilla checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} /> Ver archivadas</label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-md border bg-green-50 px-2 py-1 text-xs" title="Pone el mismo margen % a todas las rutas que estás viendo (usa la búsqueda para elegir un grupo)">
            Margen a las {visibles.length} visibles:
            <Entrada type="number" min={0} step="0.5" value={margenMasivo} onChange={(e) => setMargenMasivo(e.target.value)} placeholder="%" className="h-7 w-16" />
            <Button size="xs" variant="outline" disabled={!margenMasivo || visibles.length === 0} onClick={aplicarMargenMasivo}>Aplicar</Button>
          </span>
          <Button size="sm" onClick={nueva}><Plus /> Nueva ruta</Button>
        </div>
      </div>
      <div className="max-h-[72vh] overflow-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="bg-card">
              <th colSpan={4} className={cn(grupo, "bg-muted text-foreground")}>Ruta</th>
              <th colSpan={4} className={cn(grupo, "bg-amber-100 text-amber-900")}>Compra · lo que cobra el proveedor</th>
              <th colSpan={4} className={cn(grupo, "bg-green-100 text-green-900")}>Venta · lo que cobra Dams Cargo</th>
              <th colSpan={4} className={cn(grupo, "bg-muted text-foreground")}>Detalle</th>
            </tr>
            <tr className="bg-muted/90">
              <th className="px-2 py-2 font-medium">País</th>
              <th className="px-2 py-2 font-medium">Origen</th>
              <th className="px-2 py-2 font-medium" title="Línea naviera: COSCO, MSC, YML…">Naviera</th>
              <th className="px-2 py-2 font-medium" title="Qué precio es cuando el tramo tiene varios: 20GP, 40GP/HQ…">Variante</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950">Compra</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950" title="Compra + ISR y no domiciliada, si la fila los lleva">c/ impuestos</th>
              <th className="bg-amber-50 px-2 py-2 font-medium text-amber-950">Unidad</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950">Mínimo</th>
              <th className="bg-green-50 px-2 py-2 font-medium text-green-950">Margen</th>
              <th className="bg-green-50 px-2 py-2 text-right font-medium text-green-950">Valor</th>
              <th className="bg-green-50 px-2 py-2 text-center font-medium text-green-950" title={`Lleva ISR ${recargos.isr_pct}% + no domiciliada ${recargos.no_domiciliada_pct}%`}>Imp.</th>
              <th className="bg-green-50 px-2 py-2 text-right font-medium text-green-950">Venta</th>
              <th className="px-2 py-2 text-right font-medium" title="Venta menos lo que cuesta (compra con impuestos)">Ganancia</th>
              <th className="px-2 py-2 font-medium">Tránsito</th>
              <th className="px-2 py-2 font-medium" title="Puerto de trasbordo, si hay">Vía</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.length === 0 && (
              <tr><td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">Sin rutas. Agrega la primera o adjunta el tarifario y cárgalas.</td></tr>
            )}
            {visibles.map((f) => {
              const v = venta(f);
              const cImp = costoConImpuestos(f);
              const ganancia = v != null && f.costo != null ? redondear(v - (cImp ?? f.costo)) : null;
              const pct = ganancia != null && (cImp ?? f.costo ?? 0) > 0 ? Math.round((ganancia / (cImp ?? f.costo ?? 1)) * 1000) / 10 : null;
              return (
                <tr key={f._clave} className={cn("hover:bg-muted/30", f.archivado_at && "opacity-50", f.costo == null && "bg-amber-50/60")}>
                  <td className="px-2 py-1"><Entrada value={f.pais ?? ""} onChange={(e) => actualizar(f._clave, { pais: e.target.value })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="px-2 py-1"><Entrada value={f.origen} autoFocus={!f.id} onChange={(e) => actualizar(f._clave, { origen: e.target.value })} onBlur={() => guardar(f._clave)} className="min-w-32 font-medium" /></td>
                  <td className="px-2 py-1"><Entrada value={f.naviera ?? ""} onChange={(e) => actualizar(f._clave, { naviera: e.target.value })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="px-2 py-1"><Entrada value={f.variante ?? ""} placeholder="20GP" onChange={(e) => actualizar(f._clave, { variante: e.target.value })} onBlur={() => guardar(f._clave)} className="w-24" /></td>
                  <td className="bg-amber-50/50 px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.costo ?? ""} placeholder="falta" onChange={(e) => actualizar(f._clave, { costo: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-24 text-right font-semibold" /></td>
                  <td className="num bg-amber-50/50 px-2 py-1 text-right text-xs text-muted-foreground whitespace-nowrap">{f.aplica_recargos && cImp != null ? formatoMoneda(cImp, tarifario.moneda) : "—"}</td>
                  <td className="bg-amber-50/50 px-2 py-1">
                    <Selector value={f.unidad} onChange={(e) => guardar(f._clave, { unidad: e.target.value as F["unidad"] })} className="w-28">
                      {UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.texto}</option>)}
                    </Selector>
                  </td>
                  <td className="bg-amber-50/50 px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.minimo ?? ""} onChange={(e) => actualizar(f._clave, { minimo: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-20" /></td>
                  <td className="bg-green-50/50 px-2 py-1">
                    <Selector value={f.tipo_margen} onChange={(e) => guardar(f._clave, { tipo_margen: e.target.value as F["tipo_margen"] })} className="w-28">
                      {TIPOS_MARGEN.map((t) => <option key={t.valor} value={t.valor}>{t.corto}</option>)}
                    </Selector>
                  </td>
                  <td className="bg-green-50/50 px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.valor_margen} onChange={(e) => actualizar(f._clave, { valor_margen: Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-16" /></td>
                  <td className="bg-green-50/50 px-2 py-1 text-center"><Casilla checked={f.aplica_recargos} onChange={(e) => guardar(f._clave, { aplica_recargos: e.target.checked })} /></td>
                  <td className="num bg-green-50/50 px-2 py-1 text-right font-semibold text-green-900 whitespace-nowrap">{v == null ? <span className="text-amber-700">falta monto</span> : formatoMoneda(v, tarifario.moneda)}</td>
                  <td className="num px-2 py-1 text-right text-xs whitespace-nowrap">{ganancia == null ? "—" : <><span className="font-medium text-green-800">{formatoMoneda(ganancia, tarifario.moneda)}</span>{pct != null && <span className="ml-1 text-muted-foreground">{pct}%</span>}</>}</td>
                  <td className="px-2 py-1"><Entrada value={f.transito ?? ""} placeholder="30-35" onChange={(e) => actualizar(f._clave, { transito: e.target.value })} onBlur={() => guardar(f._clave)} className="w-16" /></td>
                  <td className="px-2 py-1"><Entrada value={f.via ?? ""} onChange={(e) => actualizar(f._clave, { via: e.target.value })} onBlur={() => guardar(f._clave)} className="w-24" /></td>
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
        <strong>Compra</strong> es lo que cobra el proveedor; <strong>c/ impuestos</strong> le suma ISR {recargos.isr_pct}% y no domiciliada {recargos.no_domiciliada_pct}% cuando la fila los lleva (Imp.). <strong>Venta</strong> = ese costo × (1 + margen). <strong>Ganancia</strong> = venta − costo con impuestos. Se guarda al salir de cada celda.
      </p>
    </section>
  );
}
