"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { SECCIONES, infoSeccion, textoUnidad, type DefServicio } from "@/lib/etiquetas";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoMoneda, formatoFecha } from "@/lib/calculo/formato";
import type { LineaEditable } from "@/lib/cotizaciones/esquema";
import type { Catalogo } from "@/lib/tarifas/consultas";
import type { Concepto, TarifaRuta } from "@/lib/supabase/tipos";
import type { Categoria, Moneda, Recargos, TipoMargen, Unidad } from "@/lib/calculo/tipos";
import { ControlMargen } from "./ControlMargen";
import { cn } from "@/lib/utils";

interface Props {
  servicio: DefServicio;
  lineas: LineaEditable[];
  catalogo: Catalogo;
  onChange: (fn: (ls: LineaEditable[]) => LineaEditable[]) => void;
  medidas: { pesoCobrable: number; cbm: number };
  margenDefault: { tipo: TipoMargen; valor: number };
  recargos: Recargos;
}

let contador = 0;
const clave = () => `l-${Date.now()}-${contador++}`;
/** "Direct" → Directo, "Indirect" → Indirecto, "Hong Kong" → Vía Hong Kong. */
const textoVia = (via: string | null) => {
  if (!via) return null;
  const v = via.trim().toLowerCase();
  if (v === "direct" || v === "directo") return "Servicio directo";
  if (v === "indirect" || v === "indirecto") return "Servicio indirecto";
  return `Vía ${via}`;
};
const LB_POR_KG = 2.20462;

export function Servicios({ servicio, lineas, catalogo, onChange, medidas, margenDefault, recargos }: Props) {
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>(() => Object.fromEntries(servicio.secciones.map((s, i) => [s, i < 2])));
  const [busquedaRuta, setBusquedaRuta] = useState<Record<string, string>>({});
  const [verTodas, setVerTodas] = useState(false);

  const provNombre = useMemo(() => new Map(catalogo.proveedores.map((p) => [p.id, p.nombre])), [catalogo.proveedores]);
  const tarifarioPorId = useMemo(() => new Map(catalogo.tarifarios.map((t) => [t.id, t])), [catalogo.tarifarios]);

  /** Cantidad inicial según la unidad del concepto (spec §7.2-B, ampliada con libras). */
  const cantidadPara = (u: Unidad) => {
    if (u === "kg") return medidas.pesoCobrable || 1;
    if (u === "libra") return medidas.pesoCobrable ? Math.round(medidas.pesoCobrable * LB_POR_KG * 100) / 100 : 1;
    if (u === "cbm") return medidas.cbm || 1;
    if (u === "pie_cubico") return medidas.cbm ? Math.round(medidas.cbm * 35.3147 * 100) / 100 : 1;
    return 1;
  };

  const agregarConcepto = (c: Concepto) => {
    const t = c.tarifario_id ? tarifarioPorId.get(c.tarifario_id) : undefined;
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(), concepto_id: c.id, nombre: c.nombre, categoria: c.categoria, moneda: c.moneda,
        cantidad: cantidadPara(c.unidad), costo_unitario: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen),
        lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos, nota: null, nota_visible: true,
        proveedor_nombre: c.proveedor_id ? (provNombre.get(c.proveedor_id) ?? null) : null,
        ruta: t?.origen && t?.destino && t.seccion !== "gastos_locales" ? `${t.origen} → ${t.destino}` : null,
        unidad: c.unidad, pendiente: c.pendiente, seccion: c.seccion,
      },
    ]);
  };
  const quitarConcepto = (id: string) => onChange((ls) => ls.filter((l) => l.concepto_id !== id));

  const agregarRuta = (r: TarifaRuta) => {
    const t = tarifarioPorId.get(r.tarifario_id);
    const prov = t?.proveedor_id ? provNombre.get(t.proveedor_id) : undefined;
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(), concepto_id: null, nombre: `Flete ${servicio.valor === "aereo" ? "aéreo" : "marítimo"} ${r.origen} → ${r.destino}`, categoria: "internacional", moneda: t?.moneda ?? "USD",
        cantidad: cantidadPara(r.unidad), costo_unitario: Number(r.costo ?? 0), tipo_margen: r.tipo_margen, valor_margen: Number(r.valor_margen),
        lleva_iva: true, aplica_recargos: r.aplica_recargos, nota: [textoVia(r.via), r.transito ? `Tránsito ${r.transito} días` : null].filter(Boolean).join(" · ") || null,
        nota_visible: true, proveedor_nombre: prov ?? null, ruta: `${r.origen} → ${r.destino}`, unidad: r.unidad, pendiente: r.costo == null, seccion: t?.seccion ?? "flete_maritimo",
      },
    ]);
  };

  const agregarManual = (seccion: string) => {
    const s = infoSeccion(seccion);
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(), concepto_id: null, nombre: "", categoria: s.categoria, moneda: s.moneda, cantidad: 1, costo_unitario: 0,
        tipo_margen: margenDefault.tipo, valor_margen: margenDefault.valor, lleva_iva: true, aplica_recargos: false,
        nota: null, nota_visible: true, proveedor_nombre: null, ruta: null, seccion,
      },
    ]);
  };

  const editar = (k: string, cambios: Partial<LineaEditable>) => onChange((ls) => ls.map((l) => (l._clave === k ? { ...l, ...cambios } : l)));
  const quitar = (k: string) => onChange((ls) => ls.filter((l) => l._clave !== k));
  const mover = (k: string, dir: -1 | 1) =>
    onChange((ls) => {
      const i = ls.findIndex((l) => l._clave === k);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const copia = [...ls];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const marcados = new Set(lineas.map((l) => l.concepto_id).filter(Boolean));
  const secciones = verTodas ? SECCIONES.map((s) => s.valor) : servicio.secciones;
  /** Sección donde se muestra una línea: la suya si está visible; si no, la primera visible de su bloque. */
  const seccionDe = (l: LineaEditable) => {
    if (l.seccion && secciones.includes(l.seccion)) return l.seccion;
    const c = l.concepto_id ? catalogo.conceptos.find((x) => x.id === l.concepto_id) : undefined;
    if (c && secciones.includes(c.seccion)) return c.seccion;
    return secciones.find((x) => infoSeccion(x).categoria === l.categoria) ?? secciones[0];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Servicios</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Casilla checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> Mostrar todas las secciones
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {secciones.map((sec) => {
          const info = infoSeccion(sec);
          const conceptos = catalogo.conceptos.filter((c) => c.seccion === sec);
          const tarifariosRuta = catalogo.tarifarios.filter((t) => t.seccion === sec && catalogo.rutas.some((r) => r.tarifario_id === t.id));
          const propias = lineas.filter((l) => seccionDe(l) === sec);
          const abierta = abiertas[sec] ?? false;
          // agrupar conceptos por tarifario (proveedor)
          const grupos = new Map<string, Concepto[]>();
          for (const c of conceptos) {
            const k = c.tarifario_id ?? "sin";
            grupos.set(k, [...(grupos.get(k) ?? []), c]);
          }
          return (
            <section key={sec} className="rounded-lg border">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setAbiertas((a) => ({ ...a, [sec]: !abierta }))}>
                {abierta ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                <span className="font-semibold text-primary">{info.texto}</span>
                <span className="text-xs text-muted-foreground">{info.descripcion} · {info.moneda}</span>
                {propias.length > 0 && <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{propias.length} en la cotización</span>}
              </button>

              {abierta && (
                <div className="space-y-3 border-t px-3 py-3">
                  {/* Rutas (fletes por origen) */}
                  {tarifariosRuta.map((t) => {
                    const rutas = catalogo.rutas.filter((r) => r.tarifario_id === t.id);
                    const q = (busquedaRuta[t.id] ?? "").toLowerCase();
                    const filtradas = q ? rutas.filter((r) => `${r.pais ?? ""} ${r.origen} ${r.via ?? ""}`.toLowerCase().includes(q)).slice(0, 12) : [];
                    return (
                      <div key={t.id} className="rounded border bg-muted/30 p-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{t.proveedor_id ? provNombre.get(t.proveedor_id) : "Propio"}</span>
                          <span className="text-xs text-muted-foreground">{t.nombre}</span>
                          {t.vencido && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-900">Vencido {t.vigencia_hasta ? formatoFecha(t.vigencia_hasta) : ""}</span>}
                          {!t.vencido && t.vigencia_hasta && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-900">Vigente al {formatoFecha(t.vigencia_hasta)}</span>}
                          <Entrada placeholder={`Buscar origen entre ${rutas.length} rutas… (ej. Xiamen)`} value={busquedaRuta[t.id] ?? ""}
                            onChange={(e) => setBusquedaRuta((b) => ({ ...b, [t.id]: e.target.value }))} className="ml-auto w-72" autoComplete="off" />
                        </div>
                        {filtradas.length > 0 && (
                          <ul className="mt-2 divide-y rounded border bg-white">
                            {filtradas.map((r) => (
                              <li key={r.id} className="flex items-center gap-3 px-2 py-1 text-sm">
                                <span className="w-24 text-muted-foreground">{r.pais}</span>
                                <span className="font-medium">{r.origen}</span>
                                <span className="text-xs text-muted-foreground">{r.via && r.via !== "Direct" ? `vía ${r.via}` : "directo"} · {r.transito ?? "—"} días</span>
                                <span className="num ml-auto">{r.costo == null ? <em className="text-amber-700">falta monto</em> : `${formatoMoneda(Number(r.costo), t.moneda)} / ${textoUnidad(r.unidad).replace("por ", "")}`}</span>
                                <Button size="xs" onClick={() => { agregarRuta(r); setBusquedaRuta((b) => ({ ...b, [t.id]: "" })); }}><Plus /> Agregar</Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}

                  {/* Conceptos por proveedor/tarifario */}
                  {[...grupos.entries()].map(([tid, cs]) => {
                    const t = tarifarioPorId.get(tid);
                    return (
                      <div key={tid}>
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{t?.proveedor_id ? provNombre.get(t.proveedor_id) : "Propio · Dams Cargo"}</span>
                          {t && <span>· {t.nombre}</span>}
                          {t?.vencido && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] text-red-900">Vencido</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {cs.map((c) => (
                            <label key={c.id} className={cn("flex cursor-pointer items-center gap-1.5 text-sm", c.pendiente && "text-amber-800")} title={c.notas ?? undefined}>
                              <Casilla checked={marcados.has(c.id)} onChange={(e) => (e.target.checked ? agregarConcepto(c) : quitarConcepto(c.id))} />
                              {c.nombre}
                              <span className="text-xs text-muted-foreground">
                                {c.unidad !== "envio" ? `(${textoUnidad(c.unidad)})` : ""} {c.pendiente ? "· falta monto" : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {conceptos.length === 0 && tarifariosRuta.length === 0 && <span className="text-xs text-muted-foreground">Sin tarifas cargadas en esta sección.</span>}

                  <div>
                    <Button variant="outline" size="sm" onClick={() => agregarManual(sec)}><Plus /> Línea manual</Button>
                  </div>

                  {/* Líneas de esta sección */}
                  {propias.length > 0 && (
                    <div className="space-y-2">
                      {propias.map((l) => {
                        const idx = lineas.findIndex((x) => x._clave === l._clave);
                        const venta = ventaLinea(l, recargos);
                        return (
                          <div key={l._clave} className={cn("rounded-lg border bg-card p-3", l.pendiente && "border-ambar")}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Entrada value={l.nombre} placeholder="Descripción" autoFocus={!l.concepto_id && !l.nombre && !l.ruta}
                                onChange={(e) => editar(l._clave, { nombre: e.target.value })} className="min-w-64 flex-1 font-medium" />
                              {l.proveedor_nombre && <span className="rounded bg-muted px-2 py-0.5 text-xs">{l.proveedor_nombre}</span>}
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                Cant.
                                <Entrada type="number" step="0.001" min={0} value={l.cantidad} onChange={(e) => editar(l._clave, { cantidad: Number(e.target.value) })} className="w-20" />
                                {l.unidad && <span>{textoUnidad(l.unidad as Unidad).replace("por ", "")}</span>}
                              </label>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Lleva ISR y no domiciliada">
                                <Casilla checked={l.aplica_recargos} onChange={(e) => editar(l._clave, { aplica_recargos: e.target.checked })} /> Imp.
                              </label>
                              <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Lleva IVA (solo Q)">
                                <Casilla checked={l.lleva_iva} onChange={(e) => editar(l._clave, { lleva_iva: e.target.checked })} /> IVA
                              </label>
                              <span className="num ml-auto text-base font-semibold">{formatoMoneda(venta, l.moneda as Moneda)}</span>
                              <div className="flex">
                                <Button variant="ghost" size="icon-xs" disabled={idx <= 0} onClick={() => mover(l._clave, -1)} title="Subir"><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-xs" disabled={idx >= lineas.length - 1} onClick={() => mover(l._clave, 1)} title="Bajar"><ArrowDown /></Button>
                                <Button variant="ghost" size="icon-xs" onClick={() => quitar(l._clave)} title="Quitar"><X /></Button>
                              </div>
                            </div>
                            <div className="mt-2">
                              <ControlMargen linea={l} recargos={recargos} onChange={(c) => editar(l._clave, c)} compacto />
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Entrada value={l.nota ?? ""} placeholder="Nota opcional (ej. precio nocturno, vía Hong Kong, tránsito 30–35 días)"
                                onChange={(e) => editar(l._clave, { nota: e.target.value || null })} className="h-7 flex-1 text-xs" />
                              <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                <Casilla checked={l.nota_visible} onChange={(e) => editar(l._clave, { nota_visible: e.target.checked })} /> Sale en el PDF
                              </label>
                              {l.categoria !== info.categoria && (
                                <Selector value={l.categoria} onChange={(e) => editar(l._clave, { categoria: e.target.value as Categoria })} className="h-7 w-40 text-xs">
                                  <option value="internacional">Bloque: Flete internacional</option>
                                  <option value="local">Bloque: Gastos locales</option>
                                  <option value="naviera">Bloque: Naviera</option>
                                </Selector>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
