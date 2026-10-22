import { crearClienteServidor } from "@/lib/supabase/server";
import type { ExtraccionTarifario } from "@/lib/ia/tarifarioIA";
import { hoyIso } from "@/lib/calculo/formato";
import { leerConfig } from "@/lib/config";
import { calcularCambios, type PropuestaActualizacion } from "./diferencias";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Compara lo extraído del documento con las filas activas del tarifario y arma la propuesta (no guarda nada). */
export async function proponerActualizacion(tarifarioId: string, extraccion: ExtraccionTarifario): Promise<PropuestaActualizacion | null> {
  const supabase = await crearClienteServidor();
  const [{ data: t }, { data: rutas }, { data: conceptos }, { recargos }] = await Promise.all([
    supabase.from("tarifarios").select("id, nombre, moneda").eq("id", tarifarioId).maybeSingle(),
    supabase.from("tarifas_ruta").select("id, origen, via, variante, naviera, costo, minimo, tipo_margen, valor_margen, aplica_recargos").eq("tarifario_id", tarifarioId).is("archivado_at", null),
    supabase.from("conceptos").select("id, nombre, costo, minimo, tipo_margen, valor_margen, aplica_recargos").eq("tarifario_id", tarifarioId).is("archivado_at", null),
    leerConfig(),
  ]);
  if (!t) return null;
  const num = (v: unknown) => (v == null ? null : Number(v));
  const cambios = calcularCambios(
    {
      rutas: (rutas ?? []).map((r) => ({ id: r.id, origen: r.origen, via: r.via, variante: r.variante, naviera: r.naviera, costo: num(r.costo), minimo: num(r.minimo), tipo_margen: r.tipo_margen, valor_margen: Number(r.valor_margen), aplica_recargos: r.aplica_recargos })),
      conceptos: (conceptos ?? []).map((c) => ({ id: c.id, nombre: c.nombre, costo: num(c.costo), minimo: num(c.minimo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), aplica_recargos: c.aplica_recargos })),
    },
    extraccion.filas,
  );
  return { tarifarioId, tarifarioNombre: t.nombre, vigencia_desde: extraccion.vigencia_desde, vigencia_hasta: extraccion.vigencia_hasta, condiciones: extraccion.condiciones_generales, moneda: t.moneda, recargos, cambios };
}

const sinIdentidad = ({ id: _id, created_at: _c, updated_at: _u, ...resto }: Record<string, unknown>) => {
  void _id; void _c; void _u;
  return resto;
};

/** Inserta por lotes y devuelve los ids nuevos en el mismo orden en que se mandaron las filas. */
async function insertarPorLotes(supabase: Supabase, tabla: "conceptos" | "tarifas_ruta" | "tarifas_cliente", filas: Record<string, unknown>[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < filas.length; i += 100) {
    const { data, error } = await supabase.from(tabla).insert(filas.slice(i, i + 100) as never).select("id");
    if (error) throw new Error(`No se pudo copiar ${tabla}.`);
    ids.push(...(data ?? []).map((d: { id: string }) => d.id));
  }
  return ids;
}

export interface CopiaTarifario {
  id: string;
  nombre: string;
  /** id original → id de la copia, para trasladar los cambios revisados a la copia. */
  rutas: Map<string, string>;
  conceptos: Map<string, string>;
}

/**
 * Copia completa del tarifario con todas sus filas activas. Sirve para dos cosas: guardar la versión anterior
 * (desactivada) antes de reemplazar, o crear la siguiente versión programada. En la copia activa también se
 * trasladan las tarifas especiales de clientes, que apuntan a conceptos concretos.
 */
export async function copiarTarifario(supabase: Supabase, id: string, sobre: { nombre: string; archivado: boolean; vigencia_desde?: string | null; vigencia_hasta?: string | null }): Promise<CopiaTarifario> {
  const { data: t } = await supabase.from("tarifarios").select("*").eq("id", id).single();
  if (!t) throw new Error("No encontré el tarifario.");
  const base = sinIdentidad(t as unknown as Record<string, unknown>);
  const { data: copia, error } = await supabase
    .from("tarifarios")
    .insert({
      ...base,
      nombre: sobre.nombre,
      documento_url: sobre.archivado ? t.documento_url : null,
      archivado_at: sobre.archivado ? new Date().toISOString() : null,
      ...(sobre.vigencia_desde !== undefined ? { vigencia_desde: sobre.vigencia_desde } : {}),
      ...(sobre.vigencia_hasta !== undefined ? { vigencia_hasta: sobre.vigencia_hasta } : {}),
    } as never)
    .select("id")
    .single();
  if (error || !copia) throw new Error("No se pudo crear la copia del tarifario.");

  const [{ data: conceptos }, { data: rutas }] = await Promise.all([
    supabase.from("conceptos").select("*").eq("tarifario_id", id).is("archivado_at", null),
    supabase.from("tarifas_ruta").select("*").eq("tarifario_id", id).is("archivado_at", null),
  ]);
  const idsConceptos = await insertarPorLotes(supabase, "conceptos", (conceptos ?? []).map((c) => ({ ...sinIdentidad(c as unknown as Record<string, unknown>), tarifario_id: copia.id })));
  const idsRutas = await insertarPorLotes(supabase, "tarifas_ruta", (rutas ?? []).map((r) => ({ ...sinIdentidad(r as unknown as Record<string, unknown>), tarifario_id: copia.id })));
  const mapaConceptos = new Map((conceptos ?? []).map((c, i) => [c.id, idsConceptos[i]] as const));
  const mapaRutas = new Map((rutas ?? []).map((r, i) => [r.id, idsRutas[i]] as const));

  if (!sobre.archivado && mapaConceptos.size) {
    const { data: especiales } = await supabase.from("tarifas_cliente").select("*").in("concepto_id", [...mapaConceptos.keys()]);
    if (especiales?.length) {
      await insertarPorLotes(supabase, "tarifas_cliente", especiales.map((e) => ({ ...sinIdentidad(e as unknown as Record<string, unknown>), concepto_id: mapaConceptos.get(e.concepto_id) })));
    }
  }
  return { id: copia.id, nombre: sobre.nombre, rutas: mapaRutas, conceptos: mapaConceptos };
}

/** Versión anterior guardada como desactivada: queda en «versiones anteriores» del proveedor. */
export async function crearRespaldoTarifario(supabase: Supabase, id: string): Promise<{ id: string; nombre: string }> {
  const { data: t } = await supabase.from("tarifarios").select("nombre").eq("id", id).single();
  const copia = await copiarTarifario(supabase, id, { nombre: `${t?.nombre ?? "Tarifario"} · anterior al ${hoyIso()}`, archivado: true });
  return { id: copia.id, nombre: copia.nombre };
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Nombre de la versión programada: «HYDE · 01/11 al 07/11» (sin acumular sufijos de versiones anteriores). */
export function nombreVersion(nombre: string, desde: string | null, hasta: string): string {
  const base = nombre.replace(/\s·\s(anterior al .*|\d{2}\/\d{2} al \d{2}\/\d{2}|\d+ al \d+ de .*)$/i, "");
  return `${base} · ${desde ? `${dm(desde)} al ` : "hasta "}${dm(hasta)}`;
}
