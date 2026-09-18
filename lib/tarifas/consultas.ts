import { crearClienteServidor } from "@/lib/supabase/server";
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

/** Todo lo activo y vigente que el editor de cotización necesita, en una sola llamada. */
export async function catalogoParaCotizar() {
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
  return {
    tarifarios: conVigencia,
    conceptos: conceptos ?? [],
    rutas: rutas ?? [],
    proveedores: proveedores ?? [],
  };
}
export type Catalogo = Awaited<ReturnType<typeof catalogoParaCotizar>>;
