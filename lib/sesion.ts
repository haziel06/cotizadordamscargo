import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Rol } from "@/lib/supabase/tipos";

export interface Sesion {
  userId: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  esAdmin: boolean;
}

/**
 * Usuario de la sesión con su rol. El rol vive en `perfiles` (no en la sesión): un admin lo puede
 * cambiar y el efecto es inmediato. Se cachea por petición.
 */
export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  if (!u) return null;
  const { data: p } = await supabase.from("perfiles").select("nombre, rol, activo").eq("user_id", u.id).maybeSingle();
  const rol: Rol = p?.rol ?? "usuario";
  const activo = p?.activo ?? true;
  return { userId: u.id, email: u.email ?? "", nombre: p?.nombre ?? "", rol, activo, esAdmin: rol === "admin" && activo };
});

/** Para páginas: exige sesión (y cuenta activa). */
export async function sesionRequerida(): Promise<Sesion> {
  const s = await sesionActual();
  if (!s) redirect("/login");
  if (!s.activo) redirect("/login?inactivo=1");
  return s;
}

/** Para páginas solo de administrador. */
export async function adminRequerido(): Promise<Sesion> {
  const s = await sesionRequerida();
  if (!s.esAdmin) redirect("/");
  return s;
}
