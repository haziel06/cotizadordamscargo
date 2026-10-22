"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Lock, Package, Plus, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Casilla, Entrada, Selector } from "@/components/Campos";
import { SECCIONES, infoSeccion, textoUnidad, type DefServicio } from "@/lib/etiquetas";
import { ventaLinea, ventaUnitariaLista } from "@/lib/calculo/linea";
import { formatoMoneda, formatoFecha } from "@/lib/calculo/formato";
import type { LineaEditable } from "@/lib/cotizaciones/esquema";
import { cantidadPorUnidad, conceptoAplicaAServicio, conceptosCourier } from "@/lib/cotizaciones/armado";
import { buscarFletes, palabras } from "@/lib/cotizaciones/fletes";
import { estiloSeccion } from "@/components/tarifas/estiloServicio";
import { guardarTarifaCliente } from "@/lib/clientes/acciones";
import type { Catalogo } from "@/lib/tarifas/consultas";
import type { Concepto, SegmentoCourier, TarifaRuta, TipoServicio } from "@/lib/supabase/tipos";
import type { Categoria, Moneda, Recargos, TipoMargen, Unidad } from "@/lib/calculo/tipos";
import { ControlMargen } from "./ControlMargen";
import { cn } from "@/lib/utils";

interface Props {
  servicio: DefServicio;
  /** Servicios de la cotización: solo se ofrecen los conceptos que aplican a alguno. */
  tipos: TipoServicio[];
  /** Solo cuando la cotización incluye courier: habilita las plantillas Ticket / Consolidado. */
  segmentoCourier: SegmentoCourier | null;
  /** Courier fuera del perímetro capitalino: no se agrega la entrega incluida. */
  fueraPerimetro?: boolean;
  lineas: LineaEditable[];
  catalogo: Catalogo;
  onChange: (fn: (ls: LineaEditable[]) => LineaEditable[]) => void;
  medidas: { pesoCobrable: number; cbm: number };
  margenDefault: { tipo: TipoMargen; valor: number };
  recargos: Recargos;
  /** Admin: ve costo y margen, mueve la barra, agrega líneas manuales. Usuario normal: solo elige y pone cantidades. */
  esAdmin: boolean;
  /** Viene de "Crear con IA" con datos suficientes: arma las líneas de courier solo, sin esperar el clic. */
  autoArmar?: boolean;
  /** Tarifas especiales del cliente de esta cotización, por concepto_id (ya en términos de venta si no eres admin). */
  tarifasCliente?: Record<string, { tipo_margen: TipoMargen; valor_margen: number }>;
  clienteNombre?: string;
  /** Origen escrito en la carga: con él se buscan y comparan los fletes de todos los tarifarios vigentes. */
  origen?: string;
  tipoCarga?: string | null;
  /** Se avisa al agregar un flete para que la carga tome su tránsito y vía. */
  onRutaAgregada?: (r: TarifaRuta) => void;
  /** Cliente guardado de la cotización: habilita "guardar este precio como tarifa del cliente" (solo admin). */
  clienteId?: string | null;
  onTarifaGuardada?: () => void;
}

/** Guarda el margen/precio de esta línea como tarifa especial del cliente: la próxima cotización de él lo traerá solo. */
function GuardarPrecioCliente({ clienteId, clienteNombre, linea, onGuardado }: { clienteId: string; clienteNombre: string; linea: LineaEditable; onGuardado?: () => void }) {
  const [estado, setEstado] = useState<"idle" | "guardando" | "ok" | string>("idle");
  const guardar = async () => {
    if (!linea.concepto_id) return;
    if (!confirm(`¿Guardar este precio como tarifa especial de ${clienteNombre || "este cliente"} para «${linea.nombre}»?\n\nLa próxima cotización de este cliente lo traerá solo.`)) return;
    setEstado("guardando");
    const r = await guardarTarifaCliente({ cliente_id: clienteId, concepto_id: linea.concepto_id, tipo_margen: linea.tipo_margen, valor_margen: linea.valor_margen, notas: null });
    if (r.ok) { setEstado("ok"); onGuardado?.(); } else setEstado(r.error);
  };
  return (
    <Button type="button" variant="outline" size="xs" disabled={estado === "guardando"} onClick={guardar} title="Guarda el margen o precio de esta línea como precio preferencial de este cliente">
      {estado === "ok" ? "Guardado para el cliente" : estado === "guardando" ? "Guardando…" : linea.esTarifaCliente ? "Actualizar tarifa del cliente" : "Guardar como tarifa del cliente"}
      {estado !== "idle" && estado !== "ok" && estado !== "guardando" && <span className="ml-1 text-destructive">{estado}</span>}
    </Button>
  );
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
const SIGUEN_MEDIDAS: Unidad[] = ["kg", "libra", "cbm", "pie_cubico"];

/**
 * Precio de venta que puede editar un usuario normal en un concepto marcado "cualquiera puede
 * ajustar" (ej. Trámite aduanal, Courier Plus, Entrega Local). Nunca se le muestra costo ni %:
 * solo el precio final por unidad. Al confirmar, la línea pasa a "precio fijo" con ese monto.
 */
function PrecioVentaEditable({ valor, moneda, nombre, onConfirmar }: { valor: number; moneda: Moneda; nombre: string; onConfirmar: (nuevo: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  const [valorVisto, setValorVisto] = useState(valor);
  if (valor !== valorVisto) {
    // El precio cambió desde afuera (ej. otro campo recalculó la línea): sincroniza el texto sin efecto.
    setValorVisto(valor);
    setTexto(String(valor));
  }
  const confirmarCambio = () => {
    const nuevo = Number(texto);
    if (!Number.isFinite(nuevo) || nuevo < 0) { setTexto(String(valor)); return; }
    if (redondearDos(nuevo) === redondearDos(valor)) { setTexto(String(valor)); return; }
    const ok = confirm(`Vas a cambiar el precio de ${formatoMoneda(valor, moneda)} a ${formatoMoneda(nuevo, moneda)} en "${nombre}". ¿Confirmas?`);
    if (ok) onConfirmar(nuevo);
    else setTexto(String(valor));
  };
  return (
    <Entrada type="number" step="0.01" min={0} value={texto} onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmarCambio} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="h-7 w-28 text-xs font-semibold" />
  );
}
const redondearDos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function Servicios({ servicio, tipos, segmentoCourier, fueraPerimetro, lineas, catalogo, onChange, medidas, margenDefault, recargos, esAdmin, autoArmar, tarifasCliente, clienteNombre, origen, tipoCarga, onRutaAgregada, clienteId, onTarifaGuardada }: Props) {
  const tarifarioPorId = useMemo(() => new Map(catalogo.tarifarios.map((t) => [t.id, t])), [catalogo.tarifarios]);
  const conceptosAplicables = useMemo(
    () => catalogo.conceptos.filter((c) => conceptoAplicaAServicio(c, c.tarifario_id ? tarifarioPorId.get(c.tarifario_id)?.servicio : null, tipos)),
    [catalogo.conceptos, tarifarioPorId, tipos],
  );
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>(() => Object.fromEntries(servicio.secciones.map((s, i) => [s, i < 2])));
  const [busquedaRuta, setBusquedaRuta] = useState<Record<string, string>>({});
  const [verTodas, setVerTodas] = useState(false);
  const [filtroProv, setFiltroProv] = useState<Record<string, string>>({});

  // Solo avisa de los vencidos que servirían para este servicio (un LCL vencido no importa al cotizar un FCL).
  const vencidos = useMemo(() => catalogo.noDisponibles.filter((t) => t.estado === "vencido" && (!t.servicio || tipos.includes(t.servicio))), [catalogo.noDisponibles, tipos]);
  const provNombre = useMemo(() => new Map(catalogo.proveedores.map((p) => [p.id, p.nombre])), [catalogo.proveedores]);

  /** Cuántas líneas de la cotización vienen de cada tarifario ("propio" = conceptos sin tarifario): responde "¿cuál estoy usando?". */
  const usoPorTarifario = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lineas) {
      const ruta = l.ruta_id ? catalogo.rutas.find((r) => r.id === l.ruta_id) : undefined;
      const concepto = !ruta && l.concepto_id ? catalogo.conceptos.find((c) => c.id === l.concepto_id) : undefined;
      const tid = ruta ? ruta.tarifario_id : concepto ? (concepto.tarifario_id ?? "propio") : undefined;
      if (tid) m.set(tid, (m.get(tid) ?? 0) + 1);
    }
    return m;
  }, [lineas, catalogo.rutas, catalogo.conceptos]);
  const nombreTarifario = (tid: string) => (tid === "propio" ? "Propio · Dams Cargo" : (tarifarioPorId.get(tid)?.nombre ?? "Tarifario"));

  const palabrasOrigen = useMemo(() => palabras(origen ?? ""), [origen]);

  /** Cantidad según la unidad del concepto (spec §7.2-B, ampliada con libras). */
  const cantidadPara = (u: Unidad) => cantidadPorUnidad(u, medidas.pesoCobrable, medidas.cbm);
  // Las líneas por peso/volumen siguen a la carga hasta que alguien escribe la cantidad a mano.
  const medidasRef = useRef(medidas);
  useEffect(() => {
    if (medidasRef.current.pesoCobrable === medidas.pesoCobrable && medidasRef.current.cbm === medidas.cbm) return;
    medidasRef.current = medidas;
    onChange((ls) => ls.map((l) => (l.unidad && SIGUEN_MEDIDAS.includes(l.unidad as Unidad) && !l.cantidad_manual ? { ...l, cantidad: cantidadPara(l.unidad as Unidad) } : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medidas.pesoCobrable, medidas.cbm]);

  const lineaDesdeConcepto = (c: Concepto): LineaEditable => {
    const t = c.tarifario_id ? tarifarioPorId.get(c.tarifario_id) : undefined;
    // Tarifa especial guardada para el cliente de esta cotización: pisa el margen/precio por
    // defecto del concepto, con un aviso visual de que es un precio ya acordado con él.
    const especial = tarifasCliente?.[c.id];
    return {
      _clave: clave(), concepto_id: c.id, ruta_id: null, nombre: c.nombre, categoria: c.categoria, moneda: c.moneda,
      cantidad: cantidadPara(c.unidad), costo_unitario: Number(c.costo),
      tipo_margen: especial?.tipo_margen ?? c.tipo_margen, valor_margen: especial ? especial.valor_margen : Number(c.valor_margen),
      lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos, cuenta_ajena: c.cuenta_ajena, nota: null, nota_visible: true,
      proveedor_nombre: c.proveedor_id ? (provNombre.get(c.proveedor_id) ?? null) : null,
      ruta: t?.origen && t?.destino && t.seccion !== "gastos_locales" ? `${t.origen} → ${t.destino}` : null,
      unidad: c.unidad, pendiente: c.pendiente, seccion: c.seccion,
      minimo: c.minimo == null ? null : Number(c.minimo), editable_por_todos: c.editable_por_todos,
      esTarifaCliente: Boolean(especial),
    };
  };
  const agregarConcepto = (c: Concepto) => onChange((ls) => [...ls, lineaDesdeConcepto(c)]);
  const quitarConcepto = (id: string) => onChange((ls) => ls.filter((l) => l.concepto_id !== id));

  const agregarRuta = (r: TarifaRuta) => {
    onRutaAgregada?.(r);
    const t = tarifarioPorId.get(r.tarifario_id);
    const prov = t?.proveedor_id ? provNombre.get(t.proveedor_id) : undefined;
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(), concepto_id: null, ruta_id: r.id, nombre: `Flete ${t?.seccion === "flete_aereo" ? "aéreo" : "marítimo"} ${r.origen} → ${r.destino}${r.variante ? ` (${r.variante})` : ""}`, categoria: "internacional", moneda: t?.moneda ?? "USD",
        cantidad: cantidadPara(r.unidad), costo_unitario: Number(r.costo ?? 0), tipo_margen: r.tipo_margen, valor_margen: Number(r.valor_margen),
        lleva_iva: true, aplica_recargos: r.aplica_recargos, cuenta_ajena: false, nota: [textoVia(r.via), r.transito ? `Tránsito ${r.transito} días` : null].filter(Boolean).join(" · ") || null,
        nota_visible: true, proveedor_nombre: [prov ?? t?.nombre, r.naviera].filter(Boolean).join(" · ") || null, ruta: `${r.origen} → ${r.destino}`, unidad: r.unidad, pendiente: r.costo == null, seccion: t?.seccion ?? "flete_maritimo",
        minimo: r.minimo == null ? null : Number(r.minimo),
      },
    ]);
  };

  const agregarManual = (seccion: string) => {
    const s = infoSeccion(seccion);
    onChange((ls) => [
      ...ls,
      {
        _clave: clave(), concepto_id: null, ruta_id: null, nombre: "", categoria: s.categoria, moneda: s.moneda, cantidad: 1, costo_unitario: 0,
        tipo_margen: seccion === "gastos_ajenos" ? "precio_fijo" : margenDefault.tipo, valor_margen: seccion === "gastos_ajenos" ? 0 : margenDefault.valor,
        lleva_iva: seccion !== "gastos_ajenos", aplica_recargos: false, cuenta_ajena: seccion === "gastos_ajenos",
        nota: null, nota_visible: true, proveedor_nombre: null, ruta: null, seccion,
      },
    ]);
  };

  /**
   * Plantillas de courier. Consolidado = solo la libra. Ticket = libra + trámite aduanero + entrega,
   * y el almacenaje (Combex) como pago a tercero, aparte. Solo agrega lo que falte.
   */
  const armarCourier = (segmento: SegmentoCourier) => {
    const nuevas = conceptosCourier(conceptosAplicables, {
      segmento, pesoCobrable: medidas.pesoCobrable, fueraPerimetro, yaMarcados: new Set(lineas.map((l) => l.concepto_id)),
    });
    if (!nuevas.length) return;
    onChange((ls) => [...ls, ...nuevas.filter((c) => !ls.some((l) => l.concepto_id === c.id)).map(lineaDesdeConcepto)]);
    setAbiertas((a) => ({ ...a, ...Object.fromEntries(nuevas.map((c) => [c.seccion, true])) }));
  };

  // "Crear con IA" con peso ya conocido: arma las líneas de una vez, como si hubieran pulsado el botón.
  // Si falta el peso (dato que la IA no pudo sacar del documento), no arma nada y queda el botón manual
  // a la vista para que quien cotiza lo complete y lo pulse él mismo.
  const autoArmadoHecho = useRef(false);
  useEffect(() => {
    if (!autoArmar || autoArmadoHecho.current || !segmentoCourier || lineas.length > 0 || !medidas.pesoCobrable) return;
    autoArmadoHecho.current = true;
    armarCourier(segmentoCourier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoArmar, segmentoCourier, lineas.length, medidas.pesoCobrable]);

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
  // Courier consolidado (compras < $1,000) no lleva trámite aduanero ni pagos a terceros: esas
  // secciones solo aparecen en Ticket. Con "Mostrar todas" se ven igual, por si hace falta.
  const soloConsolidado = tipos.length === 1 && tipos[0] === "courier" && segmentoCourier === "consolidado";
  const esComprasInternet = tipos.length === 1 && tipos[0] === "courier" && segmentoCourier === "compras_internet";
  const secciones = verTodas
    ? SECCIONES.map((s) => s.valor)
    : servicio.secciones.filter((x) => {
        if (x === "compras_internet") return esComprasInternet;
        if (soloConsolidado && (x === "documentacion" || x === "gastos_ajenos")) return false;
        return true;
      });
  /** Sección donde se muestra una línea: la suya si está visible; si no, la primera visible de su bloque. */
  const seccionDe = (l: LineaEditable) => {
    if (l.seccion && secciones.includes(l.seccion)) return l.seccion;
    const c = l.concepto_id ? catalogo.conceptos.find((x) => x.id === l.concepto_id) : undefined;
    if (c && secciones.includes(c.seccion)) return c.seccion;
    if (l.cuenta_ajena && secciones.includes("gastos_ajenos")) return "gastos_ajenos";
    return secciones.find((x) => infoSeccion(x).categoria === l.categoria) ?? secciones[0];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Servicios</CardTitle>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Casilla checked={verTodas} onChange={(e) => setVerTodas(e.target.checked)} /> Mostrar todas las secciones
          </label>
        </div>
        {segmentoCourier && segmentoCourier !== "documentos" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Package className="size-4 text-primary" />
            <span className="font-medium text-primary">Courier {segmentoCourier === "ticket" ? "Ticket" : "Consolidado"}</span>
            <span className="text-xs text-muted-foreground">
              {segmentoCourier === "ticket" ? "Libra + trámite aduanero + entrega; el almacenaje va aparte como pago a tercero." : "Solo se cobra la libra; la entrega en el perímetro capitalino va incluida."}
            </span>
            <Button size="sm" className="ml-auto" onClick={() => armarCourier(segmentoCourier)}>
              <Wand2 /> Armar {segmentoCourier === "ticket" ? "Ticket" : "Consolidado"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {vencidos.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              No se pueden usar por estar vencidos: <strong>{vencidos.slice(0, 4).map((t) => t.nombre).join(", ")}{vencidos.length > 4 ? ` y ${vencidos.length - 4} más` : ""}</strong>.
              {esAdmin ? " Renueva la fecha o sube el nuevo en Base de tarifas." : " Avisa al administrador para que los renueve."}
            </span>
          </div>
        )}
        {usoPorTarifario.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="font-medium text-primary">Estás cotizando con:</span>
            {[...usoPorTarifario.entries()].map(([tid, n]) => (
              <span key={tid} className="rounded-full bg-white px-2.5 py-0.5 font-medium shadow-sm">{nombreTarifario(tid)} <span className="text-muted-foreground">· {n} {n === 1 ? "línea" : "líneas"}</span></span>
            ))}
          </div>
        )}
        {secciones.map((sec) => {
          const info = infoSeccion(sec);
          const conceptos = conceptosAplicables.filter((c) => c.seccion === sec);
          const tarifariosRuta = catalogo.tarifarios.filter((t) => t.seccion === sec && (!t.servicio || tipos.includes(t.servicio)) && catalogo.rutas.some((r) => r.tarifario_id === t.id));
          const propias = lineas.filter((l) => seccionDe(l) === sec);
          const abierta = abiertas[sec] ?? false;
          const esAjena = sec === "gastos_ajenos";
          // agrupar conceptos por tarifario (proveedor)
          const grupos = new Map<string, Concepto[]>();
          for (const c of conceptos) {
            const k = c.tarifario_id ?? "sin";
            grupos.set(k, [...(grupos.get(k) ?? []), c]);
          }
          // Cotizar "con" un tarifario: si la sección tiene varios (HYDE, Charter Link…), se puede ver solo uno.
          const claveGrupo = (tid: string) => (tid === "sin" ? "propio" : tid);
          const tarifariosSec = new Map<string, string>();
          for (const t of tarifariosRuta) tarifariosSec.set(t.id, t.nombre);
          for (const tid of grupos.keys()) tarifariosSec.set(claveGrupo(tid), nombreTarifario(claveGrupo(tid)));
          const elegido = tarifariosSec.has(filtroProv[sec] ?? "") ? filtroProv[sec] : "";
          const rutasVisibles = tarifariosRuta.filter((t) => !elegido || t.id === elegido);
          const gruposVisibles = [...grupos.entries()].filter(([tid]) => !elegido || claveGrupo(tid) === elegido);
          // Comparador: los fletes de este origen en todos los tarifarios vigentes, de menor a mayor precio.
          const esFlete = sec === "flete_maritimo" || sec === "flete_aereo";
          const comparables = esFlete
            ? buscarFletes({ rutas: catalogo.rutas, tarifarios: rutasVisibles, origen: origen ?? "", tipoCarga, recargos }).map((x) => ({ r: x.ruta, t: x.tarifario, venta: x.venta }))
            : [];
          return (
            <section key={sec} className={cn("rounded-lg border border-l-4", estiloSeccion(sec).barra, esAjena && "border-dashed")}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setAbiertas((a) => ({ ...a, [sec]: !abierta }))}>
                {abierta ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                <span className={cn("inline-flex size-6 items-center justify-center rounded", estiloSeccion(sec).chip)}>{(() => { const I = estiloSeccion(sec).icono; return <I className="size-3.5" />; })()}</span>
                <span className="font-semibold text-primary">{info.texto}</span>
                <span className="text-xs text-muted-foreground">{info.descripcion} · {info.moneda}</span>
                {propias.length > 0 && <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{propias.length} en la cotización</span>}
              </button>

              {abierta && (
                <div className="space-y-3 border-t px-3 py-3">
                  {tarifariosSec.size > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Cotizar con:</span>
                      {[["", "Todos"], ...tarifariosSec.entries()].map(([k, nombre]) => {
                        const n = k ? (usoPorTarifario.get(k) ?? 0) : 0;
                        return (
                          <button key={k || "todos"} type="button" onClick={() => setFiltroProv((f) => ({ ...f, [sec]: k }))}
                            className={cn("rounded-full border px-2.5 py-0.5 font-medium hover:bg-muted", elegido === k && "border-primary bg-primary text-primary-foreground hover:bg-primary")}>
                            {nombre}{n > 0 && <span className="ml-1 rounded-full bg-green-600 px-1.5 text-[10px] text-white">en uso · {n}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {esFlete && palabrasOrigen.length > 0 && (
                    comparables.length > 0 ? (
                      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
                        <div className="mb-1 text-xs font-medium text-primary">Fletes desde «{origen}»{tipoCarga ? ` · ${tipoCarga}` : ""}: compara y agrega</div>
                        <ul className="divide-y rounded border bg-white">
                          {comparables.map(({ r, t, venta }, i) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1.5 text-sm">
                              <span className="min-w-40 font-medium">{t.nombre}</span>
                              <span>{r.origen}</span>
                              {r.naviera && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">{r.naviera}</span>}
                                {r.variante && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{r.variante}</span>}
                              <span className="text-xs text-muted-foreground">{r.via && r.via !== "Direct" ? `vía ${r.via}` : "directo"}{r.transito ? ` · ${r.transito}${/[a-z]/i.test(r.transito) ? "" : " días"}` : ""}</span>
                              {i === 0 && comparables.length > 1 && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-900">más económico</span>}
                              <span className="num ml-auto font-semibold">{formatoMoneda(venta, t.moneda)} <span className="text-xs font-normal text-muted-foreground">/ {textoUnidad(r.unidad).replace("por ", "")}</span></span>
                              {esAdmin && r.costo != null && <span className="text-[10px] text-muted-foreground">costo {formatoMoneda(Number(r.costo), t.moneda)}</span>}
                              {lineas.some((l) => l.ruta_id === r.id)
                                ? <span className="text-xs font-medium text-green-700">Ya agregado</span>
                                : <Button size="xs" onClick={() => agregarRuta(r)}><Plus /> Agregar</Button>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        No hay fletes para «{origen}»{tipoCarga ? ` en ${tipoCarga}` : ""} en los tarifarios vigentes. Revisa el nombre del puerto o busca abajo por tarifario.
                      </p>
                    )
                  )}
                  {/* Rutas (fletes por origen) */}
                  {rutasVisibles.map((t) => {
                    const rutas = catalogo.rutas.filter((r) => r.tarifario_id === t.id);
                    const q = (busquedaRuta[t.id] ?? "").toLowerCase();
                    const filtradas = q ? rutas.filter((r) => `${r.pais ?? ""} ${r.origen} ${r.naviera ?? ""} ${r.via ?? ""}`.toLowerCase().includes(q)).slice(0, 12) : [];
                    return (
                      <div key={t.id} className="rounded border bg-muted/30 p-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{t.nombre}</span>
                          {t.proveedor_id && !t.nombre.toLowerCase().includes((provNombre.get(t.proveedor_id) ?? "").toLowerCase()) && <span className="text-xs text-muted-foreground">{provNombre.get(t.proveedor_id)}</span>}
                          {(usoPorTarifario.get(t.id) ?? 0) > 0 && <span className="rounded bg-green-600 px-1.5 py-0.5 text-[11px] text-white">en uso · {usoPorTarifario.get(t.id)}</span>}
                          {t.estado === "por_vencer" && t.vigencia_hasta && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">Vence el {formatoFecha(t.vigencia_hasta)}</span>}
                          {t.estado === "en_uso" && t.vigencia_hasta && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[11px] text-green-900">Vigente al {formatoFecha(t.vigencia_hasta)}</span>}
                          <Entrada placeholder={`Buscar origen entre ${rutas.length} rutas… (ej. Xiamen)`} value={busquedaRuta[t.id] ?? ""}
                            onChange={(e) => setBusquedaRuta((b) => ({ ...b, [t.id]: e.target.value }))} className="ml-auto w-72" autoComplete="off" />
                        </div>
                        {filtradas.length > 0 && (
                          <ul className="mt-2 divide-y rounded border bg-white">
                            {filtradas.map((r) => (
                              <li key={r.id} className="flex items-center gap-3 px-2 py-1 text-sm">
                                <span className="w-24 text-muted-foreground">{r.pais}</span>
                                <span className="font-medium">{r.origen}</span>
                                {r.naviera && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold">{r.naviera}</span>}
                                {r.variante && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{r.variante}</span>}
                                <span className="text-xs text-muted-foreground">{r.via && r.via !== "Direct" ? `vía ${r.via}` : "directo"} · {r.transito ?? "—"} días</span>
                                <span className="num ml-auto">
                                  {r.costo == null && esAdmin ? <em className="text-amber-700">falta monto</em> : `${formatoMoneda(Number(esAdmin ? r.costo : r.valor_margen), t.moneda)} / ${textoUnidad(r.unidad).replace("por ", "")}`}
                                  {esAdmin && r.costo != null && <span className="ml-1 text-[10px] text-muted-foreground">costo</span>}
                                </span>
                                <Button size="xs" onClick={() => { agregarRuta(r); setBusquedaRuta((b) => ({ ...b, [t.id]: "" })); }}><Plus /> Agregar</Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}

                  {/* Conceptos por proveedor/tarifario */}
                  {gruposVisibles.map(([tid, cs]) => {
                    const t = tarifarioPorId.get(tid);
                    const usados = cs.filter((c) => marcados.has(c.id)).length;
                    // Con varios grupos, solo se abre el que se eligió o el que ya se está usando: menos cuadros a la vista.
                    const abiertoG = gruposAbiertos[`${sec}|${tid}`] ?? (elegido !== "" || gruposVisibles.length === 1 || usados > 0);
                    return (
                      <div key={tid}>
                        <button type="button" className="mb-1 flex w-full items-center gap-2 text-left text-xs text-muted-foreground" onClick={() => setGruposAbiertos((g) => ({ ...g, [`${sec}|${tid}`]: !abiertoG }))}>
                          {abiertoG ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span className="font-medium text-foreground">{nombreTarifario(claveGrupo(tid))}</span>
                          <span>{cs.length} {cs.length === 1 ? "concepto" : "conceptos"}</span>
                          {usados > 0 && <span className="rounded bg-green-600 px-1.5 py-0.5 text-[11px] text-white">en uso · {usados}</span>}
                          {t?.estado === "por_vencer" && t.vigencia_hasta && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-900">Vence el {formatoFecha(t.vigencia_hasta)}</span>}
                        </button>
                        {abiertoG && <div className="flex flex-wrap gap-x-4 gap-y-1.5 pl-5">
                          {cs.map((c) => {
                            const especial = tarifasCliente?.[c.id];
                            const ventaUnit = especial
                              ? ventaLinea({ nombre: c.nombre, categoria: c.categoria, moneda: c.moneda, cantidad: 1, costo_unitario: Number(c.costo), tipo_margen: especial.tipo_margen, valor_margen: especial.valor_margen, lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos }, recargos)
                              : ventaLinea({ nombre: c.nombre, categoria: c.categoria, moneda: c.moneda, cantidad: 1, costo_unitario: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos }, recargos);
                            return (
                              <label key={c.id} className={cn("flex cursor-pointer items-center gap-1.5 text-sm", c.pendiente && "text-amber-800")} title={esAdmin ? (c.notas ?? undefined) : undefined}>
                                <Casilla checked={marcados.has(c.id)} onChange={(e) => (e.target.checked ? agregarConcepto(c) : quitarConcepto(c.id))} />
                                {c.nombre}
                                {especial && <span className="rounded bg-ambar/20 px-1 py-0.5 text-[10px] font-medium text-amber-900" title={`Tarifa especial guardada para ${clienteNombre || "este cliente"}`}>especial</span>}
                                <span className="text-xs text-muted-foreground">
                                  {c.pendiente && !c.cuenta_ajena ? "· falta monto" : ventaUnit > 0 ? `· ${formatoMoneda(ventaUnit, c.moneda)}${c.unidad !== "envio" ? ` ${textoUnidad(c.unidad)}` : ""}` : c.unidad !== "envio" ? `(${textoUnidad(c.unidad)})` : ""}
                                </span>
                              </label>
                            );
                          })}
                        </div>}
                      </div>
                    );
                  })}
                  {conceptos.length === 0 && tarifariosRuta.length === 0 && <span className="text-xs text-muted-foreground">Sin tarifas cargadas en esta sección.</span>}

                  {(esAdmin || esAjena) && (
                    <div>
                      <Button variant="outline" size="sm" onClick={() => agregarManual(sec)}><Plus /> {esAjena ? "Pago a tercero" : "Línea manual"}</Button>
                    </div>
                  )}

                  {/* Líneas de esta sección */}
                  {propias.length > 0 && (
                    <div className="space-y-2">
                      {propias.map((l) => {
                        const idx = lineas.findIndex((x) => x._clave === l._clave);
                        const venta = ventaLinea(l, recargos);
                        const editaPrecio = esAdmin || l.cuenta_ajena;
                        return (
                          <div key={l._clave} className={cn("rounded-lg border bg-card p-3", l.pendiente && !l.cuenta_ajena && "border-ambar", l.cuenta_ajena && "border-dashed bg-muted/30")}>
                            <div className="flex flex-wrap items-center gap-2">
                              <Entrada value={l.nombre} placeholder="Descripción" autoFocus={!l.concepto_id && !l.nombre && !l.ruta} readOnly={!esAdmin && !!l.concepto_id}
                                onChange={(e) => editar(l._clave, { nombre: e.target.value })} className="min-w-64 flex-1 font-medium" />
                              {l.proveedor_nombre && esAdmin && <span className="rounded bg-muted px-2 py-0.5 text-xs">{l.proveedor_nombre}</span>}
                              {l.cuenta_ajena && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">Pago a tercero · aparte</span>}
                              {l.esTarifaCliente && (
                                <span className="rounded bg-ambar/20 px-2 py-0.5 text-xs font-medium text-amber-900" title="Precio ya acordado con este cliente; puedes dejarlo o cambiarlo para esta cotización.">
                                  Tarifa guardada para {clienteNombre || "este cliente"}
                                </span>
                              )}
                              {esAdmin && clienteId && l.concepto_id && !l.cuenta_ajena && (
                                <GuardarPrecioCliente clienteId={clienteId} clienteNombre={clienteNombre ?? ""} linea={l} onGuardado={onTarifaGuardada} />
                              )}
                              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                Cant.
                                <Entrada type="number" step="0.001" min={0} value={l.cantidad} onChange={(e) => editar(l._clave, { cantidad: Number(e.target.value), cantidad_manual: true })} className="w-20" />
                                {l.unidad && <span>{textoUnidad(l.unidad as Unidad).replace("por ", "")}</span>}
                              </label>
                              {esAdmin && !l.cuenta_ajena && (
                                <>
                                  <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Lleva ISR y no domiciliada">
                                    <Casilla checked={l.aplica_recargos} onChange={(e) => editar(l._clave, { aplica_recargos: e.target.checked })} /> Imp.
                                  </label>
                                  <label className="flex items-center gap-1 text-xs text-muted-foreground" title="Lleva IVA (solo Q)">
                                    <Casilla checked={l.lleva_iva} onChange={(e) => editar(l._clave, { lleva_iva: e.target.checked })} /> IVA
                                  </label>
                                </>
                              )}
                              <span className="num ml-auto text-base font-semibold">{formatoMoneda(venta, l.moneda as Moneda)}</span>
                              <div className="flex">
                                <Button variant="ghost" size="icon-xs" disabled={idx <= 0} onClick={() => mover(l._clave, -1)} title="Subir"><ArrowUp /></Button>
                                <Button variant="ghost" size="icon-xs" disabled={idx >= lineas.length - 1} onClick={() => mover(l._clave, 1)} title="Bajar"><ArrowDown /></Button>
                                <Button variant="ghost" size="icon-xs" onClick={() => quitar(l._clave)} title="Quitar"><X /></Button>
                              </div>
                            </div>
                            <div className="mt-2">
                              {l.cuenta_ajena ? (
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  Monto que paga el cliente al tercero ({l.moneda === "USD" ? "$" : "Q"} por unidad)
                                  <Entrada type="number" step="0.01" min={0} value={l.valor_margen} className="h-7 w-28 text-xs"
                                    onChange={(e) => editar(l._clave, { tipo_margen: "precio_fijo", valor_margen: Number(e.target.value), costo_unitario: 0 })} />
                                  <span>Sin margen: no suma al total ni a la utilidad.</span>
                                </label>
                              ) : editaPrecio ? (
                                <ControlMargen linea={l} recargos={recargos} onChange={(c) => editar(l._clave, c)} compacto />
                              ) : l.editable_por_todos ? (
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  Precio de venta (por {l.unidad ? textoUnidad(l.unidad as Unidad).replace("por ", "") : "unidad"})
                                  <PrecioVentaEditable valor={ventaUnitariaLista(l, recargos)} moneda={l.moneda as Moneda} nombre={l.nombre}
                                    onConfirmar={(nuevo) => editar(l._clave, { tipo_margen: "precio_fijo", valor_margen: nuevo })} />
                                </label>
                              ) : (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Lock className="size-3" /> Precio unitario {formatoMoneda(ventaUnitariaLista(l, recargos), l.moneda as Moneda)} · lo fija el administrador.
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Entrada value={l.nota ?? ""} placeholder="Nota opcional (ej. precio nocturno, vía Hong Kong, tránsito 30–35 días)"
                                onChange={(e) => editar(l._clave, { nota: e.target.value || null })} className="h-7 flex-1 text-xs" />
                              <label className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                <Casilla checked={l.nota_visible} onChange={(e) => editar(l._clave, { nota_visible: e.target.checked })} /> Sale en el PDF
                              </label>
                              {esAdmin && l.categoria !== info.categoria && !l.cuenta_ajena && (
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
