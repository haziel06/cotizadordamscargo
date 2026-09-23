"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/sesion";
import { tarifasEspecialesCliente } from "./consultas";

export type Resultado = { ok: true; id?: string } | { ok: false; error: string };

const texto = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().nullable());

const esquemaCliente = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().trim().min(1, "El nombre es obligatorio"),
  empresa: texto,
  contacto_nombre: texto,
  contacto_telefono: texto,
  contacto_email: texto,
  nit: texto,
  notas: texto,
  activo: z.boolean().default(true),
});
export type DatosCliente = z.infer<typeof esquemaCliente>;

/** Cualquier usuario puede guardar un cliente (lo necesita al cotizar); el mismo permiso que ya tenía la tabla. */
export async function guardarCliente(datos: DatosCliente): Promise<Resultado> {
  const parsed = esquemaCliente.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { id, ...resto } = parsed.data;
  const supabase = await crearClienteServidor();
  const q = id
    ? supabase.from("clientes").update(resto).eq("id", id).select("id").single()
    : supabase.from("clientes").insert(resto).select("id").single();
  const { data, error } = await q;
  if (error) return { ok: false, error: "No se pudo guardar el cliente." };
  revalidatePath("/clientes");
  return { ok: true, id: data.id };
}

export async function archivarCliente(id: string, activo: boolean): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("clientes").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo cambiar el estado." };
  revalidatePath("/clientes");
  return { ok: true };
}

const esquemaTarifaCliente = z.object({
  cliente_id: z.string().uuid(),
  concepto_id: z.string().uuid(),
  tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
  valor_margen: z.coerce.number().min(0),
  notas: texto,
});
export type DatosTarifaCliente = z.infer<typeof esquemaTarifaCliente>;

/**
 * Solo un administrador decide el precio especial de un cliente para un concepto (igual que
 * cualquier margen). Upsert por (cliente_id, concepto_id): volver a guardar el mismo par
 * simplemente actualiza el valor, no crea un duplicado.
 */
export async function guardarTarifaCliente(datos: DatosTarifaCliente): Promise<Resultado> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede fijar tarifas especiales." };
  const parsed = esquemaTarifaCliente.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("tarifas_cliente").upsert(parsed.data, { onConflict: "cliente_id,concepto_id" }).select("id").single();
  if (error) return { ok: false, error: "No se pudo guardar la tarifa especial." };
  revalidatePath(`/clientes/${parsed.data.cliente_id}`);
  return { ok: true, id: data.id };
}

/** Para el editor de cotización: tarifas especiales del cliente elegido, ya listas para usar (nunca costo crudo si no eres admin). */
export async function obtenerTarifasEspecialesAccion(clienteId: string): Promise<Record<string, { tipo_margen: "porcentaje" | "monto_fijo" | "precio_fijo"; valor_margen: number }>> {
  if (!/^[0-9a-f-]{36}$/i.test(clienteId)) return {};
  const sesion = await sesionActual();
  if (!sesion) return {};
  const mapa = await tarifasEspecialesCliente(clienteId, { ocultarCostos: !sesion.esAdmin });
  return Object.fromEntries(mapa);
}

export async function eliminarTarifaCliente(id: string, clienteId: string): Promise<Resultado> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede quitar una tarifa especial." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tarifas_cliente").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo borrar la tarifa especial." };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
