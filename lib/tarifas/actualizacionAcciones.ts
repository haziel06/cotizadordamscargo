"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sesionActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { prepararDocumento } from "@/lib/ia/documento";
import { extraerTarifarioDeDocumento } from "@/lib/ia/tarifarioIA";
import { infoSeccion } from "@/lib/etiquetas";
import { guardarConcepto, guardarRuta } from "./acciones";
import { crearRespaldoTarifario, proponerActualizacion } from "./actualizacion";
import { nombreConcepto, type PropuestaActualizacion } from "./diferencias";

export type ResultadoPropuesta = { ok: true; propuesta: PropuestaActualizacion } | { ok: false; error: string };

/** Solo administradores: lee el archivo y propone qué cambia en el tarifario elegido, sin guardar nada. */
export async function proponerActualizacionAccion(form: FormData): Promise<ResultadoPropuesta> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede actualizar tarifas." };
  const archivo = form.get("archivo");
  const tarifarioId = String(form.get("tarifarioId") ?? "");
  if (!(archivo instanceof File)) return { ok: false, error: "Elige un archivo." };
  if (!/^[0-9a-f-]{36}$/i.test(tarifarioId)) return { ok: false, error: "Elige qué tarifario actualizar." };
  const preparado = await prepararDocumento(archivo);
  if (!preparado.ok) return preparado;
  try {
    const extraccion = await extraerTarifarioDeDocumento(preparado.doc);
    const propuesta = await proponerActualizacion(tarifarioId, extraccion);
    return propuesta ? { ok: true, propuesta } : { ok: false, error: "No encontré ese tarifario." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el documento." };
  }
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pon hasta qué fecha vale este tarifario.");
const esquemaAplicar = z.object({
  tarifarioId: z.string().uuid(),
  vigencia_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  vigencia_hasta: fecha,
  crearRespaldo: z.boolean(),
  cambios: z.array(z.object({
    tipo: z.enum(["ruta", "concepto"]),
    estado: z.enum(["nuevo", "cambia"]),
    existenteId: z.string().uuid().nullable(),
    tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
    valor_margen: z.coerce.number().min(0),
    fila: z.object({
      nombre: z.string(), pais: z.string(), variante: z.string(), origen: z.string(), destino: z.string(), via: z.string(), transito: z.string(), notas: z.string(),
      costo: z.coerce.number().min(0), minimo: z.coerce.number().min(0).nullable(),
      unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"]),
    }),
  })),
});
export type DatosAplicar = z.input<typeof esquemaAplicar>;

export type ResultadoAplicar = { ok: true; actualizadas: number; nuevas: number; respaldo: string | null } | { ok: false; error: string };

/**
 * Aplica la propuesta revisada: antes guarda una copia de la versión anterior, actualiza SOLO el costo (y mínimo/tránsito)
 * de las filas que cambiaron —el margen que ya tenían se respeta—, agrega las nuevas con el margen indicado y
 * deja la nueva fecha de vigencia. Lo que el documento no menciona no se toca.
 */
export async function aplicarActualizacionAccion(datos: DatosAplicar): Promise<ResultadoAplicar> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede actualizar tarifas." };
  const parsed = esquemaAplicar.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { tarifarioId, cambios } = parsed.data;

  const supabase = await crearClienteServidor();
  const { data: t } = await supabase.from("tarifarios").select("*").eq("id", tarifarioId).maybeSingle();
  if (!t) return { ok: false, error: "No encontré ese tarifario." };

  try {
    const respaldo = parsed.data.crearRespaldo && cambios.length > 0 ? await crearRespaldoTarifario(supabase, tarifarioId) : null;

    let actualizadas = 0;
    let nuevas = 0;
    const categoria = infoSeccion(t.seccion).categoria;
    for (const [i, c] of cambios.entries()) {
      const f = c.fila;
      if (c.estado === "cambia" && c.existenteId) {
        const base = { costo: f.costo, ...(f.minimo != null ? { minimo: f.minimo } : {}) };
        const { error } = c.tipo === "ruta"
          ? await supabase.from("tarifas_ruta").update({ ...base, ...(f.transito ? { transito: f.transito } : {}) }).eq("id", c.existenteId).eq("tarifario_id", tarifarioId)
          : await supabase.from("conceptos").update(base).eq("id", c.existenteId).eq("tarifario_id", tarifarioId);
        if (error) throw new Error(`No se pudo actualizar «${f.origen || f.nombre}».`);
        actualizadas++;
      } else if (c.estado === "nuevo") {
        const r = c.tipo === "ruta"
          ? await guardarRuta({ tarifario_id: tarifarioId, pais: f.pais || null, origen: f.origen || "—", destino: f.destino || t.destino || "Guatemala", via: f.via || null, variante: f.variante || null, costo: f.costo, unidad: f.unidad, minimo: f.minimo, transito: f.transito || null, tipo_margen: c.tipo_margen, valor_margen: c.valor_margen, aplica_recargos: true, notas: f.notas || null })
          : await guardarConcepto({ tarifario_id: tarifarioId, proveedor_id: t.proveedor_id, nombre: nombreConcepto(f), categoria, seccion: t.seccion, moneda: t.moneda, unidad: f.unidad, costo: f.costo, minimo: f.minimo, rango_desde: null, rango_hasta: null, tipo_margen: c.tipo_margen, valor_margen: c.valor_margen, aplica_recargos: true, aplica_iva: true, pendiente: false, orden: 1000 + i, notas: f.notas || null, servicios: [], editable_por_todos: false });
        if (!r.ok) throw new Error(r.error);
        nuevas++;
      }
    }

    const { error } = await supabase.from("tarifarios").update({ vigencia_hasta: parsed.data.vigencia_hasta, ...(parsed.data.vigencia_desde ? { vigencia_desde: parsed.data.vigencia_desde } : {}) }).eq("id", tarifarioId);
    if (error) throw new Error("Se aplicaron los precios pero no se pudo guardar la fecha de vigencia.");

    revalidatePath("/tarifas");
    revalidatePath(`/tarifas/${tarifarioId}`);
    return { ok: true, actualizadas, nuevas, respaldo: respaldo?.nombre ?? null };
  } catch (e) {
    revalidatePath("/tarifas");
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo aplicar la actualización." };
  }
}
