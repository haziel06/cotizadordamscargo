"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { totalesCotizacion, ventasFinales } from "@/lib/calculo/totales";
import { ventaLinea } from "@/lib/calculo/linea";
import { hoyIso } from "@/lib/calculo/formato";
import { esquemaGuardar } from "./esquema";
import type { Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];
export type Resultado = { ok: true; id: string } | { ok: false; error: string };

/**
 * Guarda cabecera y líneas. Los totales se calculan aquí con el mismo motor que usa
 * la pantalla, y las líneas se congelan tal cual (spec §4, regla crítica).
 */
export async function guardarCotizacion(entrada: unknown): Promise<Resultado> {
  const parsed = esquemaGuardar.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, cabecera, lineas } = parsed.data;

  const { descuentos, notas, ...cab } = cabecera;
  const t = totalesCotizacion(lineas, cab.tipo_cambio, descuentos);
  const finales = ventasFinales(lineas, cab.tipo_cambio, descuentos);
  const lineasDb = lineas.map((l, i) => ({ ...l, venta_total: finales[i], venta_bruta: ventaLinea(l), orden: i }));

  const supabase = await crearClienteServidor();
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
  if (error || !data) return { ok: false, error: "No se pudo guardar la cotización." };

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
