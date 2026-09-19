"use server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoAuth = { error?: string; aviso?: string } | undefined;

export async function iniciarSesion(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const correo = String(form.get("correo") ?? "").trim();
  const clave = String(form.get("clave") ?? "");
  if (!correo || !clave) return { error: "Escribe tu correo y contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) return { error: error.message.includes("confirm") ? "Confirma tu correo antes de entrar." : "Correo o contraseña incorrectos." };
  redirect("/");
}

/**
 * Registro con código de invitación. El código se comprueba primero (mensaje claro) y la base
 * lo vuelve a exigir al crear el usuario (trigger), así nadie se registra saltándose el formulario.
 * Toda cuenta nueva entra como usuario normal; el rol admin se obtiene con la clave de administrador.
 */
export async function registrarse(_: EstadoAuth, form: FormData): Promise<EstadoAuth> {
  const nombre = String(form.get("nombre") ?? "").trim();
  const correo = String(form.get("correo") ?? "").trim().toLowerCase();
  const clave = String(form.get("clave") ?? "");
  const codigo = String(form.get("codigo") ?? "").trim().toUpperCase();
  if (!nombre || !correo || !clave || !codigo) return { error: "Completa todos los campos." };
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await crearClienteServidor();
  const { data: valido } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
  if (!valido) return { error: "Código de invitación inválido o vencido. Pídele uno al administrador." };

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    options: { data: { nombre, codigo_invitacion: codigo } },
  });
  if (error) {
    if (error.message.toLowerCase().includes("already")) return { error: "Ese correo ya tiene cuenta. Inicia sesión." };
    if (error.message.toLowerCase().includes("database")) return { error: "Código de invitación inválido o vencido." };
    return { error: "No se pudo crear la cuenta. Intenta de nuevo." };
  }
  if (data.session) redirect("/");
  return { aviso: "Cuenta creada. Revisa tu correo y confirma la dirección para entrar." };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
