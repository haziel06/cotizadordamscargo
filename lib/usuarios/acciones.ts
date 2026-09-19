"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";
import { sesionActual } from "@/lib/sesion";

type Resultado<T = undefined> = { ok: true; dato?: T } | { ok: false; error: string };

/** Genera una clave nueva (invalida la anterior). Se muestra una sola vez. */
export async function regenerarClaveAdmin(): Promise<Resultado<string>> {
  const s = await sesionActual();
  if (!s?.esAdmin) return { ok: false, error: "Solo un administrador puede hacer esto." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("regenerar_clave_admin");
  if (error || !data) return { ok: false, error: "No se pudo generar la clave." };
  return { ok: true, dato: data };
}

/** Un usuario normal escribe la clave y queda como administrador. */
export async function canjearClaveAdmin(clave: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("canjear_clave_admin", { p_clave: clave });
  if (error) return { ok: false, error: "No se pudo comprobar la clave." };
  if (!data) return { ok: false, error: "Clave incorrecta." };
  revalidatePath("/", "layout");
  return { ok: true };
}

const esquemaRol = z.object({ user_id: z.string().uuid(), rol: z.enum(["admin", "usuario"]), activo: z.boolean() });
export async function cambiarRolUsuario(datos: z.infer<typeof esquemaRol>): Promise<Resultado> {
  const parsed = esquemaRol.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const s = await sesionActual();
  if (!s?.esAdmin) return { ok: false, error: "Solo un administrador puede hacer esto." };
  if (parsed.data.user_id === s.userId && (parsed.data.rol !== "admin" || !parsed.data.activo)) {
    return { ok: false, error: "No puedes quitarte el rol de administrador a ti mismo." };
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("cambiar_rol_usuario", { p_user: parsed.data.user_id, p_rol: parsed.data.rol, p_activo: parsed.data.activo });
  if (error) return { ok: false, error: "No se pudo cambiar el rol." };
  revalidatePath("/usuarios");
  return { ok: true };
}

const esquemaInvitacion = z.object({
  nota: z.string().trim().max(120).default(""),
  usos_max: z.coerce.number().int().min(1).max(100).default(1),
  dias: z.coerce.number().int().min(0).max(365).default(7),
});
/** Crea un código de invitación: de un uso o multiuso, con o sin caducidad. */
export async function crearInvitacion(datos: z.infer<typeof esquemaInvitacion>): Promise<Resultado<string>> {
  const parsed = esquemaInvitacion.safeParse(datos);
  if (!parsed.success) return { ok: false, error: "Revisa los datos." };
  const s = await sesionActual();
  if (!s?.esAdmin) return { ok: false, error: "Solo un administrador puede hacer esto." };
  const supabase = await crearClienteServidor();
  const { data: codigo } = await supabase.rpc("generar_codigo_invitacion");
  if (!codigo) return { ok: false, error: "No se pudo generar el código." };
  const vence = parsed.data.dias > 0 ? new Date(Date.now() + parsed.data.dias * 86400000).toISOString() : null;
  const { error } = await supabase.from("invitaciones").insert({ codigo, nota: parsed.data.nota, usos_max: parsed.data.usos_max, vence_at: vence, creado_por: s.userId });
  if (error) return { ok: false, error: "No se pudo guardar la invitación." };
  revalidatePath("/usuarios");
  return { ok: true, dato: codigo };
}

export async function desactivarInvitacion(id: string, activo: boolean): Promise<Resultado> {
  const s = await sesionActual();
  if (!s?.esAdmin) return { ok: false, error: "Solo un administrador puede hacer esto." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("invitaciones").update({ activo }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar." };
  revalidatePath("/usuarios");
  return { ok: true };
}
