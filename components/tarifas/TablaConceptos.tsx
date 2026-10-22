"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { SECCIONES, SERVICIOS_CORTOS, TIPOS_MARGEN, UNIDADES, infoSeccion } from "@/lib/etiquetas";
import { costoBase, redondear, ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda } from "@/lib/calculo/formato";
import type { Recargos } from "@/lib/calculo/tipos";
import type { Concepto, Tarifario } from "@/lib/supabase/tipos";
import { archivarConcepto, eliminarConcepto, guardarConcepto, type DatosConcepto } from "@/lib/tarifas/acciones";
import { claveNueva, useFilasEditables, type Fila } from "./useFilasEditables";
import { cn } from "@/lib/utils";

type F = Fila<DatosConcepto & { archivado_at?: string | null }>;

const aFila = (c: Concepto): F => ({
  _clave: c.id, id: c.id, tarifario_id: c.tarifario_id, proveedor_id: c.proveedor_id, nombre: c.nombre, categoria: c.categoria,
  seccion: c.seccion, moneda: c.moneda, unidad: c.unidad, costo: Number(c.costo), minimo: c.minimo == null ? null : Number(c.minimo),
  rango_desde: c.rango_desde == null ? null : Number(c.rango_desde), rango_hasta: c.rango_hasta == null ? null : Number(c.rango_hasta),
  tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), aplica_recargos: c.aplica_recargos, aplica_iva: c.aplica_iva,
  pendiente: c.pendiente, orden: c.orden, notas: c.notas, archivado_at: c.archivado_at, servicios: c.servicios ?? [], editable_por_todos: c.editable_por_todos ?? false,
});

export function TablaConceptos({ tarifario, conceptos, recargos }: { tarifario: Tarifario; conceptos: Concepto[]; recargos: Recargos }) {
  const router = useRouter();
  const { filas, actualizar, guardar, agregar, quitar } = useFilasEditables<DatosConcepto & { archivado_at?: string | null }>(
    conceptos.map(aFila), guardarConcepto, (f) => f.nombre.trim().length > 0,
  );
  const [q, setQ] = useState("");
  const [verArchivados, setVerArchivados] = useState(false);
  const [margenMasivo, setMargenMasivo] = useState("");
  const [, startTransition] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return filas.filter((f) => (verArchivados || !f.archivado_at) && (!t || f.nombre.toLowerCase().includes(t)));
  }, [filas, q, verArchivados]);

  const nuevo = () => {
    const sec = infoSeccion(tarifario.seccion);
    const maxOrden = Math.max(0, ...filas.map((f) => f.orden));
    agregar({
      _clave: claveNueva(), tarifario_id: tarifario.id, proveedor_id: tarifario.proveedor_id, nombre: "", categoria: sec.categoria, seccion: tarifario.seccion,
      moneda: tarifario.moneda, unidad: "envio", costo: 0, minimo: null, rango_desde: null, rango_hasta: null,
      tipo_margen: tarifario.proveedor_id ? "porcentaje" : "precio_fijo", valor_margen: tarifario.proveedor_id ? 40 : 0,
      aplica_recargos: Boolean(tarifario.proveedor_id) && tarifario.moneda === "USD", aplica_iva: true, pendiente: false, orden: maxOrden + 10, notas: "", servicios: [], editable_por_todos: false,
    });
  };

  const archivar = (f: F) => startTransition(async () => { if (f.id) { await archivarConcepto(f.id, !f.archivado_at); actualizar(f._clave, { archivado_at: f.archivado_at ? null : new Date().toISOString() }); } });
  const borrar = (f: F) => {
    if (!f.id) return quitar(f._clave);
    if (!confirm(`¿Borrar definitivamente "${f.nombre}"? Las cotizaciones ya guardadas conservan su copia.`)) return;
    startTransition(async () => { const r = await eliminarConcepto(f.id!); if (r.ok) quitar(f._clave); else alert(r.error); router.refresh(); });
  };

  const linea = (f: F) => ({ nombre: "", categoria: f.categoria, moneda: f.moneda, cantidad: 1, costo_unitario: f.costo, tipo_margen: f.tipo_margen, valor_margen: f.valor_margen, lleva_iva: f.aplica_iva, aplica_recargos: f.aplica_recargos });
  const venta = (f: F) => ventaLinea(linea(f), recargos);
  const tieneCosto = (f: F) => f.costo > 0 && f.tipo_margen !== "precio_fijo";

  const aplicarMargenMasivo = () => {
    const pct = Number(margenMasivo);
    if (!Number.isFinite(pct) || pct < 0 || pct > 300) return alert("Pon un porcentaje entre 0 y 300.");
    const objetivo = visibles.filter((f) => f.id && f.costo > 0 && !f.editable_por_todos);
    if (!confirm(`¿Poner ${pct}% de margen a ${objetivo.length} conceptos con costo de los que se ven ahora? Cambia su precio de venta.`)) return;
    for (const f of objetivo) guardar(f._clave, { tipo_margen: "porcentaje", valor_margen: pct });
    setMargenMasivo("");
  };

  const grupo = "px-2 py-1 text-center text-[11px] font-semibold tracking-wide uppercase";
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-primary">Conceptos <span className="text-xs font-normal text-muted-foreground">({visibles.length})</span></h2>
        <Entrada placeholder="Buscar concepto…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" autoComplete="off" />
        <label className="flex items-center gap-2 text-sm"><Casilla checked={verArchivados} onChange={(e) => setVerArchivados(e.target.checked)} /> Ver archivados</label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-md border bg-green-50 px-2 py-1 text-xs" title="Pone el mismo margen % a los conceptos con costo que estás viendo">
            Margen a los visibles:
            <Entrada type="number" min={0} step="0.5" value={margenMasivo} onChange={(e) => setMargenMasivo(e.target.value)} placeholder="%" className="h-7 w-16" />
            <Button size="xs" variant="outline" disabled={!margenMasivo || visibles.length === 0} onClick={aplicarMargenMasivo}>Aplicar</Button>
          </span>
          <Button size="sm" onClick={nuevo}><Plus /> Nuevo concepto</Button>
        </div>
      </div>
      <div className="max-h-[72vh] overflow-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="bg-card">
              <th className={cn(grupo, "bg-muted text-foreground")}>Concepto</th>
              <th colSpan={4} className={cn(grupo, "bg-amber-100 text-amber-900")}>Compra · lo que cobra el proveedor</th>
              <th colSpan={6} className={cn(grupo, "bg-green-100 text-green-900")}>Venta · lo que cobra Dams Cargo</th>
              <th colSpan={5} className={cn(grupo, "bg-muted text-foreground")}>Detalle</th>
            </tr>
            <tr className="bg-muted/90">
              <th className="px-2 py-2 font-medium">Nombre</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950">Compra</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950" title="Compra + ISR y no domiciliada, si lleva impuestos">c/ impuestos</th>
              <th className="bg-amber-50 px-2 py-2 font-medium text-amber-950">Unidad</th>
              <th className="bg-amber-50 px-2 py-2 text-right font-medium text-amber-950">Mínimo</th>
              <th className="bg-green-50 px-2 py-2 font-medium text-green-950">Margen</th>
              <th className="bg-green-50 px-2 py-2 text-right font-medium text-green-950">Valor</th>
              <th className="bg-green-50 px-2 py-2 text-center font-medium text-green-950" title={`Lleva ISR ${recargos.isr_pct}% + no domiciliada ${recargos.no_domiciliada_pct}%`}>Imp.</th>
              <th className="bg-green-50 px-2 py-2 text-center font-medium text-green-950">IVA</th>
              <th className="bg-green-50 px-2 py-2 text-right font-medium text-green-950">Venta</th>
              <th className="px-2 py-2 text-right font-medium" title="Venta menos lo que cuesta (compra con impuestos)">Ganancia</th>
              <th className="px-2 py-2 font-medium">Sección</th>
              <th className="px-2 py-2 font-medium" title="Servicios en los que se ofrece. Ninguno marcado = todos.">Aplica a</th>
              <th className="px-2 py-2 text-right font-medium">Rango</th>
              <th className="px-2 py-2 text-center font-medium" title="Cualquier usuario puede ajustar el precio de venta final, sin ver costo ni margen">Cualquiera</th>
              <th className="px-2 py-2 text-center font-medium" title="Falta monto">Falta</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibles.length === 0 && (
              <tr><td colSpan={17} className="px-3 py-8 text-center text-muted-foreground">Sin conceptos en este tarifario.</td></tr>
            )}
            {visibles.map((f) => {
              const v = venta(f);
              const cImp = f.costo > 0 ? redondear(costoBase(linea(f), recargos)) : null;
              const ganancia = tieneCosto(f) || (f.costo > 0 && f.tipo_margen === "precio_fijo") ? redondear(v - (cImp ?? f.costo)) : null;
              return (
                <tr key={f._clave} className={cn("hover:bg-muted/30", f.archivado_at && "opacity-50", f.pendiente && "bg-amber-50/60")}>
                  <td className="px-2 py-1">
                    <Entrada value={f.nombre} autoFocus={!f.id} placeholder="Nombre del concepto" onChange={(e) => actualizar(f._clave, { nombre: e.target.value })} onBlur={() => guardar(f._clave)} className="min-w-52 font-medium" />
                    {f.notas ? <div className="mt-0.5 max-w-64 truncate text-[11px] text-muted-foreground" title={f.notas}>{f.notas}</div> : null}
                    {f._error && <div className="text-[11px] text-destructive">{f._error}</div>}
                  </td>
                  <td className="bg-amber-50/50 px-2 py-1"><Entrada type="number" step="0.01" min={0} value={f.costo} onChange={(e) => actualizar(f._clave, { costo: Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="w-24 text-right font-semibold" disabled={f.tipo_margen === "precio_fijo" && !f.proveedor_id} /></td>
                  <td className="num bg-amber-50/50 px-2 py-1 text-right text-xs text-muted-foreground whitespace-nowrap">{f.aplica_recargos && cImp != null ? formatoMoneda(cImp, f.moneda) : "—"}</td>
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
                  <td className="bg-green-50/50 px-2 py-1 text-center"><Casilla checked={f.aplica_iva} onChange={(e) => guardar(f._clave, { aplica_iva: e.target.checked })} /></td>
                  <td className="num bg-green-50/50 px-2 py-1 text-right font-semibold text-green-900 whitespace-nowrap">{f.pendiente ? <span className="text-amber-700">falta monto</span> : formatoMoneda(v, f.moneda)}</td>
                  <td className="num px-2 py-1 text-right text-xs whitespace-nowrap">{ganancia == null ? "—" : <span className="font-medium text-green-800">{formatoMoneda(ganancia, f.moneda)}</span>}</td>
                  <td className="px-2 py-1">
                    <Selector value={f.seccion} onChange={(e) => guardar(f._clave, { seccion: e.target.value, categoria: infoSeccion(e.target.value).categoria })} className="w-36">
                      {SECCIONES.map((s) => <option key={s.valor} value={s.valor}>{s.texto}</option>)}
                    </Selector>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex w-36 flex-wrap gap-0.5">
                      {SERVICIOS_CORTOS.map((sv) => {
                        const on = f.servicios.includes(sv.valor);
                        return (
                          <button key={sv.valor} type="button" title={on ? "Quitar" : "Solo en este servicio"}
                            className={cn("rounded border px-1 text-[10px] leading-4", on ? "border-primary bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-muted")}
                            onClick={() => guardar(f._clave, { servicios: on ? f.servicios.filter((x) => x !== sv.valor) : [...f.servicios, sv.valor] })}>
                            {sv.corto}
                          </button>
                        );
                      })}
                      {f.servicios.length === 0 && <span className="text-[10px] text-muted-foreground">todos</span>}
                    </div>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <Entrada type="number" min={0} value={f.rango_desde ?? ""} placeholder="de" onChange={(e) => actualizar(f._clave, { rango_desde: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="inline-block w-14" />
                    <span className="mx-0.5 text-muted-foreground">–</span>
                    <Entrada type="number" min={0} value={f.rango_hasta ?? ""} placeholder="a" onChange={(e) => actualizar(f._clave, { rango_hasta: e.target.value === "" ? null : Number(e.target.value) })} onBlur={() => guardar(f._clave)} className="inline-block w-14" />
                  </td>
                  <td className="px-2 py-1 text-center"><Casilla checked={f.editable_por_todos} onChange={(e) => guardar(f._clave, { editable_por_todos: e.target.checked })} /></td>
                  <td className="px-2 py-1 text-center"><Casilla checked={f.pendiente} onChange={(e) => guardar(f._clave, { pendiente: e.target.checked })} /></td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <span className="mr-1 inline-block w-14 text-right text-[11px] text-muted-foreground">{f._estado === "guardando" ? "…" : f._estado === "guardado" ? "Guardado" : ""}</span>
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
        <strong>Compra</strong> es lo que cobra el proveedor; <strong>c/ impuestos</strong> le suma ISR {recargos.isr_pct}% y no domiciliada {recargos.no_domiciliada_pct}% cuando lleva Imp. <strong>Venta</strong> = precio por 1 unidad con el margen actual; <strong>Ganancia</strong> = venta − costo con impuestos. <strong>Falta</strong> = todavía no hay monto confirmado; al cotizar avisa.
      </p>
    </section>
  );
}
