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
  // Acepta el código pegado como sea: "inv-kkkuum", con espacios, o el enlace completo de invitación.
  const crudo = String(form.get("codigo") ?? "");
  const encontrado = crudo.toUpperCase().replace(/\s+/g, "").match(/INV-?([A-Z0-9]{6})/);
  const codigo = encontrado ? `INV-${encontrado[1]}` : "";
  if (!nombre || !correo || !clave) return { error: "Completa todos los campos." };
  if (!codigo) return { error: `No reconozco el código "${crudo.trim()}". Tiene la forma INV-XXXXXX (6 letras o números).` };
  if (clave.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const supabase = await crearClienteServidor();
  const { data: valido, error: errValidar } = await supabase.rpc("validar_invitacion", { p_codigo: codigo });
  if (errValidar) {
    console.error("validar_invitacion", errValidar);
    return { error: "No se pudo comprobar el código. Intenta de nuevo en un momento." };
  }
  if (!valido) return { error: `El código ${codigo} ya se usó, está vencido o fue desactivado. Pídele uno nuevo al administrador.` };

  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: clave,
    options: { data: { nombre, codigo_invitacion: codigo } },
  });
  if (error) {
    console.error("signUp", error.status, error.message);
    const m = error.message.toLowerCase();
    if (m.includes("already")) return { error: "Ese correo ya tiene cuenta. Inicia sesión." };
    if (m.includes("rate limit") || error.status === 429) return { error: "Se enviaron demasiados correos de confirmación en la última hora. Espera un rato o pide al administrador que desactive la confirmación por correo." };
    if (m.includes("database")) return { error: `La base rechazó el registro con el código ${codigo} (¿lo usó otra persona hace un momento?). Pide uno nuevo.` };
    return { error: `No se pudo crear la cuenta: ${error.message}` };
  }
  if (data.session) redirect("/");
  return { aviso: "Cuenta creada. Revisa tu correo y confirma la dirección para entrar." };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
