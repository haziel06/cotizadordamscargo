"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

const esquemaConcepto = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoria: z.enum(["internacional", "local", "naviera"]),
  proveedor_id: z.string().uuid().nullable(),
  moneda: z.enum(["USD", "GTQ"]),
  unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra"]),
  costo: z.coerce.number().min(0),
  tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
  valor_margen: z.coerce.number().min(0),
  aplica_iva: z.boolean(),
  activo: z.boolean(),
  orden: z.coerce.number().int(),
  notas: z.string().nullable(),
});
export type DatosConcepto = z.infer<typeof esquemaConcepto>;

export type Resultado = { ok: true; id?: string } | { ok: false; error: string };

export async function guardarConcepto(datos: DatosConcepto): Promise<Resultado> {
  const parsed = esquemaConcepto.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...resto } = parsed.data;
  const supabase = await crearClienteServidor();

  const q = id
    ? supabase.from("conceptos").update(resto).eq("id", id).select("id").single()
    : supabase.from("conceptos").insert(resto).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: "No se pudo guardar el concepto." };
  revalidatePath("/tarifas");
  return { ok: true, id: data.id };
}

/** Borra solo si nunca se usó en una cotización; si se usó, hay que desactivar. */
export async function eliminarConcepto(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("cotizacion_lineas")
    .select("id", { count: "exact", head: true })
    .eq("concepto_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Este concepto ya se usó en cotizaciones. Desactívalo en vez de borrarlo." };
  }
  const { error } = await supabase.from("conceptos").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar el concepto." };
  revalidatePath("/tarifas");
  return { ok: true };
}

const esquemaProveedor = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  tipo: z.enum(["naviera", "agente_origen", "transportista", "courier", "almacenadora", "custodio", "otro"]),
  pais: z.string().nullable(),
  moneda_default: z.enum(["USD", "GTQ"]),
  activo: z.boolean(),
});
export type DatosProveedor = z.infer<typeof esquemaProveedor>;

export async function guardarProveedor(datos: DatosProveedor): Promise<Resultado> {
  const parsed = esquemaProveedor.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...resto } = parsed.data;
  const supabase = await crearClienteServidor();
  const q = id
    ? supabase.from("proveedores").update(resto).eq("id", id).select("id").single()
    : supabase.from("proveedores").insert(resto).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: "No se pudo guardar el proveedor." };
  revalidatePath("/tarifas");
  return { ok: true, id: data.id };
}
