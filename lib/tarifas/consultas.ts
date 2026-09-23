import { crearClienteServidor } from "@/lib/supabase/server";
import { ventaLinea } from "@/lib/calculo/linea";
import { SIN_RECARGOS, type Categoria, type Moneda, type Recargos, type TipoMargen } from "@/lib/calculo/tipos";
import { hoyIso } from "@/lib/calculo/formato";
import type { Concepto, Proveedor, Tarifario, TarifaRuta } from "@/lib/supabase/tipos";

export type EstadoVigencia = "vigente" | "por_vencer" | "vencido" | "sin_fecha";

/** Vigente / por vencer (≤ 5 días) / vencido, según fechas del tarifario. */
export function estadoVigencia(t: Pick<Tarifario, "vigencia_desde" | "vigencia_hasta">): EstadoVigencia {
  const hoy = hoyIso();
  if (!t.vigencia_hasta) return "sin_fecha";
  if (t.vigencia_hasta < hoy) return "vencido";
  const dias = Math.round((Date.parse(t.vigencia_hasta) - Date.parse(hoy)) / 86400000);
  return dias <= 5 ? "por_vencer" : "vigente";
}

export interface TarifarioResumen extends Tarifario {
  proveedor_nombre: string | null;
  n_conceptos: number;
  n_rutas: number;
  vigencia: EstadoVigencia;
}

export async function listarTarifarios(incluirArchivados = false): Promise<TarifarioResumen[]> {
  const supabase = await crearClienteServidor();
  const [{ data: tarifarios }, { data: proveedores }, { data: conceptos }, { data: rutas }] = await Promise.all([
    supabase.from("tarifarios").select("*").order("seccion").order("nombre"),
    supabase.from("proveedores").select("id, nombre"),
    supabase.from("conceptos").select("tarifario_id").is("archivado_at", null),
    supabase.from("tarifas_ruta").select("tarifario_id").is("archivado_at", null),
  ]);
  const nombreProv = new Map((proveedores ?? []).map((p) => [p.id, p.nombre]));
  const cuenta = (xs: { tarifario_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    for (const x of xs ?? []) if (x.tarifario_id) m.set(x.tarifario_id, (m.get(x.tarifario_id) ?? 0) + 1);
    return m;
  };
  const nc = cuenta(conceptos);
  const nr = cuenta(rutas);
  return (tarifarios ?? [])
    .filter((t) => incluirArchivados || !t.archivado_at)
    .map((t) => ({
      ...t,
      proveedor_nombre: t.proveedor_id ? (nombreProv.get(t.proveedor_id) ?? null) : null,
      n_conceptos: nc.get(t.id) ?? 0,
      n_rutas: nr.get(t.id) ?? 0,
      vigencia: estadoVigencia(t),
    }));
}

export async function obtenerTarifario(id: string): Promise<{
  tarifario: Tarifario;
  conceptos: Concepto[];
  rutas: TarifaRuta[];
  proveedores: Proveedor[];
} | null> {
  const supabase = await crearClienteServidor();
  const [{ data: tarifario }, { data: conceptos }, { data: rutas }, { data: proveedores }] = await Promise.all([
    supabase.from("tarifarios").select("*").eq("id", id).maybeSingle(),
    supabase.from("conceptos").select("*").eq("tarifario_id", id).order("orden").order("nombre"),
    supabase.from("tarifas_ruta").select("*").eq("tarifario_id", id).order("pais").order("origen"),
    supabase.from("proveedores").select("*").order("nombre"),
  ]);
  if (!tarifario) return null;
  return { tarifario, conceptos: conceptos ?? [], rutas: rutas ?? [], proveedores: proveedores ?? [] };
}

/**
 * Todo lo activo y vigente que el editor de cotización necesita, en una sola llamada.
 * Para un usuario normal los costos y márgenes NUNCA salen del servidor: cada concepto y ruta
 * llega como "precio fijo" igual a la venta unitaria (costo 0, sin recargos).
 */
export async function catalogoParaCotizar(opciones: { ocultarCostos?: boolean; recargos?: Recargos } = {}) {
  const supabase = await crearClienteServidor();
  const hoy = hoyIso();
  const [{ data: tarifarios }, { data: conceptos }, { data: rutas }, { data: proveedores }] = await Promise.all([
    supabase.from("tarifarios").select("*").is("archivado_at", null).order("nombre"),
    supabase.from("conceptos").select("*").is("archivado_at", null).order("seccion").order("orden").order("nombre"),
    supabase.from("tarifas_ruta").select("*").is("archivado_at", null).order("pais").order("origen"),
    supabase.from("proveedores").select("id, nombre").eq("activo", true),
  ]);
  // Los tarifarios vencidos siguen visibles pero marcados: la oficina decide si los usa.
  const conVigencia = (tarifarios ?? []).map((t) => ({ ...t, vencido: Boolean(t.vigencia_hasta && t.vigencia_hasta < hoy) }));
  if (!opciones.ocultarCostos) {
    return { tarifarios: conVigencia, conceptos: conceptos ?? [], rutas: rutas ?? [], proveedores: proveedores ?? [] };
  }
  const r = opciones.recargos ?? SIN_RECARGOS;
  return {
    tarifarios: conVigencia,
    conceptos: (conceptos ?? []).map((c) => soloVenta(c, Number(c.costo), c.categoria, c.moneda, r)),
    rutas: (rutas ?? []).map((x) => soloVenta(x, Number(x.costo ?? 0), "internacional", "USD", r)),
    proveedores: proveedores ?? [],
  };
}

/**
 * Sustituye costo/margen por la venta unitaria como precio fijo. Sirve para conceptos y rutas.
 * Si el concepto tiene mínimo de proveedor (ej. "mínimo 80 lb"), lo convertimos también a su
 * equivalente en venta, para que el mínimo se siga respetando aunque el usuario normal ya no
 * vea costo ni margen (ventaLinea también aplica el mínimo al precio fijo).
 */
export function soloVenta<T extends { tipo_margen: TipoMargen; valor_margen: number; aplica_recargos: boolean; minimo?: number | null }>(
  x: T, costo: number, categoria: Categoria, moneda: Moneda, r: Recargos,
): T {
  const base = { nombre: "", categoria, moneda, cantidad: 1, costo_unitario: costo, tipo_margen: x.tipo_margen, valor_margen: Number(x.valor_margen), lleva_iva: false, aplica_recargos: x.aplica_recargos };
  const venta = ventaLinea(base, r);
  const minimoVenta = x.minimo != null ? ventaLinea({ ...base, costo_unitario: Number(x.minimo) }, r) : null;
  return { ...x, costo: 0, tipo_margen: "precio_fijo", valor_margen: venta, aplica_recargos: false, minimo: minimoVenta };
}
export type Catalogo = Awaited<ReturnType<typeof catalogoParaCotizar>>;
