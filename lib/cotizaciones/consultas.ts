import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaVencimiento, hoyIso } from "@/lib/calculo/formato";
import type { Cotizacion, CotizacionLinea, Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];

/** `vencida` no se guarda: se calcula al leer (fecha + vigencia < hoy, salvo aceptada/rechazada). */
export function estadoEfectivo(c: Pick<Cotizacion, "estado" | "fecha" | "dias_vigencia">): Estado {
  if (c.estado === "aceptada" || c.estado === "rechazada") return c.estado;
  return fechaVencimiento(c.fecha, c.dias_vigencia) < hoyIso() ? "vencida" : c.estado;
}

/** RLS ya limita: el usuario normal solo ve las suyas; el admin ve todas y puede filtrar por persona. */
export async function listarCotizaciones(filtro: { estado?: string; q?: string; usuario?: string; limite?: number } = {}) {
  const supabase = await crearClienteServidor();
  let query = supabase.from("cotizaciones").select("*").order("created_at", { ascending: false }).limit(filtro.limite ?? 200);
  if (filtro.q) query = query.ilike("cliente_nombre", `%${filtro.q}%`);
  if (filtro.usuario) query = query.eq("creado_por", filtro.usuario);
  const { data } = await query;
  const filas = (data ?? []).map((c) => ({ ...c, estado_efectivo: estadoEfectivo(c) }));
  return filtro.estado ? filas.filter((c) => c.estado_efectivo === filtro.estado) : filas;
}

export async function obtenerCotizacion(id: string, opciones: { ocultarCostos?: boolean } = {}): Promise<{ cotizacion: Cotizacion; lineas: CotizacionLinea[] } | null> {
  const supabase = await crearClienteServidor();
  const [{ data: cotizacion }, { data: lineas }] = await Promise.all([
    supabase.from("cotizaciones").select("*").eq("id", id).maybeSingle(),
    supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id).order("orden"),
  ]);
  if (!cotizacion) return null;
  if (!opciones.ocultarCostos) return { cotizacion, lineas: lineas ?? [] };
  // Usuario normal: la línea llega como precio fijo igual a su venta unitaria; el costo no sale del servidor.
  const limpias = (lineas ?? []).map((l) => {
    const cant = Number(l.cantidad) || 1;
    return { ...l, costo_unitario: 0, aplica_recargos: false, tipo_margen: "precio_fijo" as const, valor_margen: Math.round((Number(l.venta_bruta) / cant) * 100) / 100 };
  });
  return { cotizacion: { ...cotizacion, costo_total_gtq: 0, utilidad_gtq: 0, margen_pct: 0 }, lineas: limpias };
}

/** Nombres de usuarios (para el filtro por persona y la columna "creada por"). */
export async function listarPerfiles() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("perfiles").select("user_id, nombre, email, rol, activo").order("nombre");
  return data ?? [];
}

/** Catálogos que necesita el editor. */
export async function datosEditor() {
  const supabase = await crearClienteServidor();
  const [{ data: conceptos }, { data: clientes }] = await Promise.all([
    supabase.from("conceptos").select("*").eq("activo", true).order("categoria").order("orden").order("nombre"),
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
  ]);
  return { conceptos: conceptos ?? [], clientes: clientes ?? [] };
}
