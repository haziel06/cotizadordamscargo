import { crearClienteServidor } from "@/lib/supabase/server";
import { fechaVencimiento, hoyIso } from "@/lib/calculo/formato";
import type { Cotizacion, CotizacionLinea, Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];

/** `vencida` no se guarda: se calcula al leer (fecha + vigencia < hoy, salvo aceptada/rechazada). */
export function estadoEfectivo(c: Pick<Cotizacion, "estado" | "fecha" | "dias_vigencia">): Estado {
  if (c.estado === "aceptada" || c.estado === "rechazada") return c.estado;
  return fechaVencimiento(c.fecha, c.dias_vigencia) < hoyIso() ? "vencida" : c.estado;
}

export async function listarCotizaciones(filtro: { estado?: string; q?: string } = {}) {
  const supabase = await crearClienteServidor();
  let query = supabase.from("cotizaciones").select("*").order("created_at", { ascending: false }).limit(200);
  if (filtro.q) query = query.ilike("cliente_nombre", `%${filtro.q}%`);
  const { data } = await query;
  const filas = (data ?? []).map((c) => ({ ...c, estado_efectivo: estadoEfectivo(c) }));
  return filtro.estado ? filas.filter((c) => c.estado_efectivo === filtro.estado) : filas;
}

export async function obtenerCotizacion(id: string): Promise<{ cotizacion: Cotizacion; lineas: CotizacionLinea[] } | null> {
  const supabase = await crearClienteServidor();
  const [{ data: cotizacion }, { data: lineas }] = await Promise.all([
    supabase.from("cotizaciones").select("*").eq("id", id).maybeSingle(),
    supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id).order("orden"),
  ]);
  if (!cotizacion) return null;
  return { cotizacion, lineas: lineas ?? [] };
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
