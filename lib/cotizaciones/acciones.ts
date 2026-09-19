"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { totalesCotizacion, ventasFinales } from "@/lib/calculo/totales";
import { ventaLinea } from "@/lib/calculo/linea";
import { hoyIso } from "@/lib/calculo/formato";
import { esquemaGuardar } from "./esquema";
import { leerConfig } from "@/lib/config";
import { sesionActual } from "@/lib/sesion";
import type { Database } from "@/lib/supabase/tipos";
import type { z as Z } from "zod";
import type { esquemaLinea } from "./esquema";

type LineaEntrada = Z.infer<typeof esquemaLinea>;

/**
 * Un usuario normal nunca manda costos ni márgenes: solo qué concepto/ruta, cuánto y sus notas.
 * Aquí se reconstruye cada línea desde la base (o desde la línea ya congelada si la cotización existía).
 * Las líneas manuales no se permiten; los pagos a terceros (cuenta ajena) sí aceptan el monto escrito.
 */
async function reconstruirLineasVendedor(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, id: string | null, lineas: LineaEntrada[]): Promise<LineaEntrada[] | string> {
  const conceptoIds = [...new Set(lineas.map((l) => l.concepto_id).filter((x): x is string => !!x))];
  const rutaIds = [...new Set(lineas.map((l) => l.ruta_id).filter((x): x is string => !!x))];
  const [{ data: conceptos }, { data: rutas }, { data: previas }] = await Promise.all([
    conceptoIds.length ? supabase.from("conceptos").select("*").in("id", conceptoIds) : Promise.resolve({ data: [] }),
    rutaIds.length ? supabase.from("tarifas_ruta").select("*").in("id", rutaIds) : Promise.resolve({ data: [] }),
    id ? supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id) : Promise.resolve({ data: [] }),
  ]);
  const salida: LineaEntrada[] = [];
  for (const l of lineas) {
    const previa = (previas ?? []).find((p) => (l.concepto_id && p.concepto_id === l.concepto_id) || (l.ruta_id && p.ruta_id === l.ruta_id));
    const c = l.concepto_id ? (conceptos ?? []).find((x) => x.id === l.concepto_id) : undefined;
    const r = l.ruta_id ? (rutas ?? []).find((x) => x.id === l.ruta_id) : undefined;
    if (!previa && !c && !r) return `"${l.nombre || "Línea"}" no viene de la base de tarifas. Solo un administrador puede agregar líneas manuales.`;
    const base = previa
      ? { costo_unitario: Number(previa.costo_unitario), tipo_margen: previa.tipo_margen, valor_margen: Number(previa.valor_margen), aplica_recargos: previa.aplica_recargos, cuenta_ajena: previa.cuenta_ajena, lleva_iva: previa.lleva_iva }
      : c
        ? { costo_unitario: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), aplica_recargos: c.aplica_recargos, cuenta_ajena: c.cuenta_ajena, lleva_iva: c.aplica_iva }
        : { costo_unitario: Number(r!.costo ?? 0), tipo_margen: r!.tipo_margen, valor_margen: Number(r!.valor_margen), aplica_recargos: r!.aplica_recargos, cuenta_ajena: false, lleva_iva: true };
    salida.push({
      ...l,
      ...base,
      // El monto de un pago a tercero (ej. almacenaje) sí lo puede escribir el vendedor.
      ...(base.cuenta_ajena ? { tipo_margen: "precio_fijo" as const, valor_margen: l.valor_margen, costo_unitario: 0, aplica_recargos: false } : {}),
    });
  }
  return salida;
}

type Estado = Database["public"]["Enums"]["estado_cotizacion"];
export type Resultado = { ok: true; id: string } | { ok: false; error: string };

/**
 * Guarda cabecera y líneas. Los totales se calculan aquí con el mismo motor que usa
 * la pantalla, y las líneas se congelan tal cual (spec §4, regla crítica).
 */
export async function guardarCotizacion(entrada: unknown): Promise<Resultado> {
  const parsed = esquemaGuardar.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, cabecera } = parsed.data;
  let lineas = parsed.data.lineas;

  const sesion = await sesionActual();
  if (!sesion || !sesion.activo) return { ok: false, error: "Sesión vencida." };
  const supabase = await crearClienteServidor();
  if (!sesion.esAdmin) {
    const r = await reconstruirLineasVendedor(supabase, id, lineas);
    if (typeof r === "string") return { ok: false, error: r };
    lineas = r;
  }

  const { descuentos, notas, ...cab } = cabecera;
  cab.tipo_servicio = cab.tipos_servicio[0] ?? cab.tipo_servicio;
  const { recargos } = await leerConfig();
  const t = totalesCotizacion(lineas, cab.tipo_cambio, descuentos, recargos);
  const finales = ventasFinales(lineas, cab.tipo_cambio, descuentos, recargos);
  const lineasDb = lineas.map((l, i) => ({ ...l, venta_total: finales[i], venta_bruta: ventaLinea(l, recargos), orden: i }));

  const { data, error } = await supabase.rpc("guardar_cotizacion", {
    p_id: id,
    p_cabecera: {
      ...cab,
      descuentos,
      notas,
      total_usd: t.internacional_usd + t.naviera_usd,
      total_gtq: t.total_gtq,
      costo_total_gtq: t.costo_total_gtq,
      utilidad_gtq: t.utilidad_gtq,
      margen_pct: t.margen_pct,
    },
    p_lineas: lineasDb,
  });
  if (error || !data) return { ok: false, error: id ? "No se pudo guardar. Si la cotización es de otra persona, solo un administrador puede editarla." : "No se pudo guardar la cotización." };

  revalidatePath("/");
  revalidatePath(`/cotizaciones/${data}`);
  return { ok: true, id: data };
}

export async function cambiarEstado(id: string, estado: Estado): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("cotizaciones").update({ estado }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidatePath("/");
  revalidatePath(`/cotizaciones/${id}`);
  return { ok: true, id };
}

/** Copia cabecera y líneas congeladas; nuevo número, borrador, fecha de hoy. */
export async function duplicarCotizacion(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const [{ data: c }, { data: lineas }] = await Promise.all([
    supabase.from("cotizaciones").select("*").eq("id", id).single(),
    supabase.from("cotizacion_lineas").select("*").eq("cotizacion_id", id).order("orden"),
  ]);
  if (!c) return { ok: false, error: "Cotización no encontrada." };

  const { id: _id, numero: _n, created_at: _c, updated_at: _u, ...cab } = c;
  void _id; void _n; void _c; void _u;
  const { data, error } = await supabase.rpc("guardar_cotizacion", {
    p_id: null,
    p_cabecera: { ...cab, fecha: hoyIso(), estado: "borrador" },
    p_lineas: (lineas ?? []).map(({ id: _li, cotizacion_id: _ci, ...l }) => {
      void _li; void _ci;
      return l;
    }),
  });
  if (error || !data) return { ok: false, error: "No se pudo duplicar." };
  revalidatePath("/");
  return { ok: true, id: data };
}

export async function eliminarCotizacion(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar." };
  revalidatePath("/");
  return { ok: true, id };
}

const esquemaCliente = z.object({
  nombre: z.string().trim().min(1),
  contacto_nombre: z.string().nullable().optional(),
});
/** Crea un cliente al vuelo desde el editor (cliente nuevo sin registrar). */
export async function crearCliente(datos: z.infer<typeof esquemaCliente>): Promise<Resultado> {
  const parsed = esquemaCliente.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Nombre inválido" };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("clientes").insert(parsed.data).select("id").single();
  if (error) return { ok: false, error: "No se pudo crear el cliente." };
  return { ok: true, id: data.id };
}
