"use server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function iniciarSesion(_: { error?: string } | undefined, form: FormData) {
  const correo = String(form.get("correo") ?? "").trim();
  const clave = String(form.get("clave") ?? "");
  if (!correo || !clave) return { error: "Escribe tu correo y contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/");
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
