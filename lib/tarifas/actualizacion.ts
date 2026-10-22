import { crearClienteServidor } from "@/lib/supabase/server";
import type { ExtraccionTarifario } from "@/lib/ia/tarifarioIA";
import { hoyIso } from "@/lib/calculo/formato";
import { calcularCambios, type PropuestaActualizacion } from "./diferencias";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Compara lo extraído del documento con las filas activas del tarifario y arma la propuesta (no guarda nada). */
export async function proponerActualizacion(tarifarioId: string, extraccion: ExtraccionTarifario): Promise<PropuestaActualizacion | null> {
  const supabase = await crearClienteServidor();
  const [{ data: t }, { data: rutas }, { data: conceptos }] = await Promise.all([
    supabase.from("tarifarios").select("id, nombre").eq("id", tarifarioId).maybeSingle(),
    supabase.from("tarifas_ruta").select("id, origen, via, variante, costo, minimo").eq("tarifario_id", tarifarioId).is("archivado_at", null),
    supabase.from("conceptos").select("id, nombre, costo, minimo").eq("tarifario_id", tarifarioId).is("archivado_at", null),
  ]);
  if (!t) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  const cambios = calcularCambios(
    {
      rutas: (rutas ?? []).map((r) => ({ id: r.id, origen: r.origen, via: r.via, variante: r.variante, costo: num(r.costo), minimo: num(r.minimo) })),
      conceptos: (conceptos ?? []).map((c) => ({ id: c.id, nombre: c.nombre, costo: num(c.costo), minimo: num(c.minimo) })),
    },
    extraccion.filas,
  );
  return { tarifarioId, tarifarioNombre: t.nombre, vigencia_desde: extraccion.vigencia_desde, vigencia_hasta: extraccion.vigencia_hasta, condiciones: extraccion.condiciones_generales, cambios };
}

const sinIdentidad = ({ id: _id, created_at: _c, updated_at: _u, ...resto }: Record<string, unknown>) => {
  void _id; void _c; void _u;
  return resto;
};
async function insertarPorLotes(supabase: Supabase, tabla: "conceptos" | "tarifas_ruta", filas: Record<string, unknown>[]) {
  for (let i = 0; i < filas.length; i += 100) {
    const { error } = await supabase.from(tabla).insert(filas.slice(i, i + 100) as never);
    if (error) throw new Error(`No se pudo copiar ${tabla}.`);
  }
}

/**
 * Copia completa del tarifario (con todas sus filas) guardada como desactivada: queda en "versiones anteriores"
 * del proveedor. El tarifario original conserva su id (y por tanto las tarifas especiales de clientes que lo usan).
 */
export async function crearRespaldoTarifario(supabase: Supabase, id: string): Promise<{ id: string; nombre: string }> {
  const { data: t } = await supabase.from("tarifarios").select("*").eq("id", id).single();
  if (!t) throw new Error("No encontré el tarifario.");
  const nombre = `${t.nombre} · anterior al ${hoyIso()}`;
  const { data: copia, error } = await supabase
    .from("tarifarios")
    .insert({ ...sinIdentidad(t as unknown as Record<string, unknown>), nombre, archivado_at: new Date().toISOString() } as never)
    .select("id")
    .single();
  if (error || !copia) throw new Error("No se pudo crear la copia de la versión anterior.");
  const [{ data: conceptos }, { data: rutas }] = await Promise.all([
    supabase.from("conceptos").select("*").eq("tarifario_id", id),
    supabase.from("tarifas_ruta").select("*").eq("tarifario_id", id),
  ]);
  await insertarPorLotes(supabase, "conceptos", (conceptos ?? []).map((c) => ({ ...sinIdentidad(c as unknown as Record<string, unknown>), tarifario_id: copia.id })));
  await insertarPorLotes(supabase, "tarifas_ruta", (rutas ?? []).map((r) => ({ ...sinIdentidad(r as unknown as Record<string, unknown>), tarifario_id: copia.id })));
  return { id: copia.id, nombre };
}
