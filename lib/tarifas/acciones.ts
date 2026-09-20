"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type Resultado = { ok: true; id?: string; url?: string } | { ok: false; error: string };

const num = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().nullable());
const texto = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().nullable());
const revalidar = (id?: string | null) => {
  revalidatePath("/tarifas");
  if (id) revalidatePath(`/tarifas/${id}`);
};

/* ---------------- Tarifarios ---------------- */

const esquemaTarifario = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  proveedor_id: z.string().uuid().nullable(),
  servicio: z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"]).nullable(),
  seccion: z.string().min(1),
  origen: texto,
  destino: texto,
  moneda: z.enum(["USD", "GTQ"]),
  vigencia_desde: texto,
  vigencia_hasta: texto,
  notas: texto,
});
export type DatosTarifario = z.infer<typeof esquemaTarifario>;

export async function guardarTarifario(datos: DatosTarifario): Promise<Resultado> {
  const parsed = esquemaTarifario.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...resto } = parsed.data;
  const supabase = await crearClienteServidor();
  const q = id
    ? supabase.from("tarifarios").update(resto).eq("id", id).select("id").single()
    : supabase.from("tarifarios").insert(resto).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: "No se pudo guardar el tarifario." };
  revalidar(data.id);
  return { ok: true, id: data.id };
}

/** Archivar = dejar de usar sin perder el histórico. Restaurar = volver a activo. */
export async function archivarTarifario(id: string, archivar: boolean): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifarios").update({ archivado_at: archivar ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidar(id);
  return { ok: true, id };
}

/** Borrado definitivo: desaparece del histórico. Las líneas ya cotizadas conservan su copia. */
export async function eliminarTarifario(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifarios").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar el tarifario." };
  revalidar();
  return { ok: true };
}

/** Sube el PDF/Excel original del tarifario a Storage (bucket `config`, carpeta tarifarios/). */
export async function subirDocumentoTarifario(id: string, form: FormData): Promise<Resultado> {
  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };
  if (archivo.size > 15 * 1024 * 1024) return { ok: false, error: "Máximo 15 MB." };
  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "bin";
  const ruta = `tarifarios/${id}.${ext}`;
  const supabase = await crearClienteServidor();
  const { error } = await supabase.storage.from("config").upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined });
  if (error) return { ok: false, error: "No se pudo subir el documento." };
  const { data } = supabase.storage.from("config").getPublicUrl(ruta);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  await supabase.from("tarifarios").update({ documento_url: url }).eq("id", id);
  revalidar(id);
  return { ok: true, url };
}

/* ---------------- Conceptos ---------------- */

const esquemaConcepto = z.object({
  id: z.string().uuid().optional(),
  tarifario_id: z.string().uuid().nullable(),
  proveedor_id: z.string().uuid().nullable(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  categoria: z.enum(["internacional", "local", "naviera"]),
  seccion: z.string().min(1),
  moneda: z.enum(["USD", "GTQ"]),
  unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"]),
  costo: z.coerce.number().min(0),
  minimo: num,
  rango_desde: num,
  rango_hasta: num,
  tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
  valor_margen: z.coerce.number().min(0),
  aplica_recargos: z.boolean(),
  aplica_iva: z.boolean(),
  pendiente: z.boolean(),
  orden: z.coerce.number().int(),
  notas: texto,
  /** Servicios a los que aplica; vacío = todos. */
  servicios: z.array(z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"])).default([]),
  /** Cualquier usuario (no solo admin) puede ajustar el precio de venta final, sin ver costo ni margen. */
  editable_por_todos: z.boolean().default(false),
});
export type DatosConcepto = z.infer<typeof esquemaConcepto>;

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
  revalidar(resto.tarifario_id);
  return { ok: true, id: data.id };
}

export async function archivarConcepto(id: string, archivar: boolean): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("conceptos").update({ archivado_at: archivar ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidar();
  return { ok: true, id };
}

export async function eliminarConcepto(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("conceptos").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar el concepto." };
  revalidar();
  return { ok: true };
}

/* ---------------- Rutas ---------------- */

const esquemaRuta = z.object({
  id: z.string().uuid().optional(),
  tarifario_id: z.string().uuid(),
  pais: texto,
  origen: z.string().trim().min(1, "El origen es obligatorio"),
  destino: z.string().trim().min(1).default("Guatemala"),
  via: texto,
  costo: num,
  unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"]),
  minimo: num,
  transito: texto,
  tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
  valor_margen: z.coerce.number().min(0),
  aplica_recargos: z.boolean(),
  notas: texto,
});
export type DatosRuta = z.infer<typeof esquemaRuta>;

export async function guardarRuta(datos: DatosRuta): Promise<Resultado> {
  const parsed = esquemaRuta.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...resto } = parsed.data;
  const supabase = await crearClienteServidor();
  const q = id
    ? supabase.from("tarifas_ruta").update(resto).eq("id", id).select("id").single()
    : supabase.from("tarifas_ruta").insert(resto).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: "No se pudo guardar la ruta." };
  revalidar(resto.tarifario_id);
  return { ok: true, id: data.id };
}

export async function archivarRuta(id: string, archivar: boolean): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifas_ruta").update({ archivado_at: archivar ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidar();
  return { ok: true, id };
}

export async function eliminarRuta(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifas_ruta").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la ruta." };
  revalidar();
  return { ok: true };
}

/* ---------------- Proveedores ---------------- */

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
  revalidar();
  return { ok: true, id: data.id };
}

/** Borra el proveedor si nada lo referencia todavía; si ya tiene tarifarios/rutas, sugiere desactivarlo en su lugar. */
export async function eliminarProveedor(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") return { ok: false, error: "Ya tiene tarifarios o tarifas asociadas: desmarca «Activo» en vez de borrarlo." };
    return { ok: false, error: "No se pudo borrar el proveedor." };
  }
  revalidar();
  return { ok: true };
}
