"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sesionActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { prepararDocumento } from "@/lib/ia/documento";
import { extraerTarifarioDeDocumento } from "@/lib/ia/tarifarioIA";
import { infoSeccion } from "@/lib/etiquetas";
import { guardarConcepto, guardarRuta } from "./acciones";
import { copiarTarifario, crearRespaldoTarifario, nombreVersion, proponerActualizacion } from "./actualizacion";
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
  /** version = tarifario nuevo programado (el actual no se toca); reemplazar = se actualiza el actual (con copia de la versión anterior). */
  modo: z.enum(["version", "reemplazar"]),
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
      nombre: z.string(), pais: z.string(), naviera: z.string(), variante: z.string(), origen: z.string(), destino: z.string(), via: z.string(), transito: z.string(), notas: z.string(),
      costo: z.coerce.number().min(0), minimo: z.coerce.number().min(0).nullable(),
      unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"]),
    }),
  })),
});
export type DatosAplicar = z.input<typeof esquemaAplicar>;

export type ResultadoAplicar = { ok: true; actualizadas: number; nuevas: number; aviso: string; tarifarioId: string } | { ok: false; error: string };

/**
 * Aplica la propuesta revisada. Solo cambia el costo (y mínimo/tránsito) de las filas que cambiaron —el margen que
 * ya tenían se respeta— y agrega las nuevas con el margen indicado; lo que el documento no menciona no se toca.
 * - modo "version": crea un tarifario nuevo con la vigencia del documento (copia del actual + cambios). El actual
 *   sigue valiendo hasta que venza, y la versión nueva entra sola cuando llega su fecha.
 * - modo "reemplazar": actualiza el actual y guarda antes una copia desactivada de la versión anterior.
 */
export async function aplicarActualizacionAccion(datos: DatosAplicar): Promise<ResultadoAplicar> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede actualizar tarifas." };
  const parsed = esquemaAplicar.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { tarifarioId, cambios, modo } = parsed.data;

  const supabase = await crearClienteServidor();
  const { data: t } = await supabase.from("tarifarios").select("*").eq("id", tarifarioId).maybeSingle();
  if (!t) return { ok: false, error: "No encontré ese tarifario." };

  try {
    let destinoId = tarifarioId;
    let aviso = "";
    let mapaRutas = new Map<string, string>();
    let mapaConceptos = new Map<string, string>();

    if (modo === "version") {
      const copia = await copiarTarifario(supabase, tarifarioId, {
        nombre: nombreVersion(t.nombre, parsed.data.vigencia_desde, parsed.data.vigencia_hasta), archivado: false,
        vigencia_desde: parsed.data.vigencia_desde, vigencia_hasta: parsed.data.vigencia_hasta,
      });
      destinoId = copia.id;
      mapaRutas = copia.rutas;
      mapaConceptos = copia.conceptos;
      aviso = `Se creó la versión «${copia.nombre}»${parsed.data.vigencia_desde ? ` (empieza el ${parsed.data.vigencia_desde.split("-").reverse().join("/")})` : ""}. «${t.nombre}» no se tocó y sigue valiendo hasta su fecha.`;
    } else if (parsed.data.crearRespaldo && cambios.length > 0) {
      const respaldo = await crearRespaldoTarifario(supabase, tarifarioId);
      aviso = `La versión anterior quedó guardada como «${respaldo.nombre}».`;
    }

    let actualizadas = 0;
    let nuevas = 0;
    const categoria = infoSeccion(t.seccion).categoria;
    for (const [i, c] of cambios.entries()) {
      const f = c.fila;
      if (c.estado === "cambia" && c.existenteId) {
        const objetivo = modo === "version" ? (c.tipo === "ruta" ? mapaRutas : mapaConceptos).get(c.existenteId) : c.existenteId;
        if (!objetivo) continue;
        const base = { costo: f.costo, ...(f.minimo != null ? { minimo: f.minimo } : {}) };
        const { error } = c.tipo === "ruta"
          ? await supabase.from("tarifas_ruta").update({ ...base, ...(f.transito ? { transito: f.transito } : {}) }).eq("id", objetivo).eq("tarifario_id", destinoId)
          : await supabase.from("conceptos").update(base).eq("id", objetivo).eq("tarifario_id", destinoId);
        if (error) throw new Error(`No se pudo actualizar «${f.origen || f.nombre}».`);
        actualizadas++;
      } else if (c.estado === "nuevo") {
        const r = c.tipo === "ruta"
          ? await guardarRuta({ tarifario_id: destinoId, pais: f.pais || null, origen: f.origen || "—", destino: f.destino || t.destino || "Guatemala", via: f.via || null, naviera: f.naviera || null, variante: f.variante || null, costo: f.costo, unidad: f.unidad, minimo: f.minimo, transito: f.transito || null, tipo_margen: c.tipo_margen, valor_margen: c.valor_margen, aplica_recargos: true, notas: f.notas || null })
          : await guardarConcepto({ tarifario_id: destinoId, proveedor_id: t.proveedor_id, nombre: nombreConcepto(f), categoria, seccion: t.seccion, moneda: t.moneda, unidad: f.unidad, costo: f.costo, minimo: f.minimo, rango_desde: null, rango_hasta: null, tipo_margen: c.tipo_margen, valor_margen: c.valor_margen, aplica_recargos: true, aplica_iva: true, pendiente: false, orden: 1000 + i, notas: f.notas || null, servicios: [], editable_por_todos: false });
        if (!r.ok) throw new Error(r.error);
        nuevas++;
      }
    }

    if (modo === "reemplazar") {
      const { error } = await supabase.from("tarifarios").update({ vigencia_hasta: parsed.data.vigencia_hasta, ...(parsed.data.vigencia_desde ? { vigencia_desde: parsed.data.vigencia_desde } : {}) }).eq("id", tarifarioId);
      if (error) throw new Error("Se aplicaron los precios pero no se pudo guardar la fecha de vigencia.");
    }

    revalidatePath("/tarifas");
    revalidatePath(`/tarifas/${destinoId}`);
    return { ok: true, actualizadas, nuevas, aviso, tarifarioId: destinoId };
  } catch (e) {
    revalidatePath("/tarifas");
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo aplicar la actualización." };
  }
}
