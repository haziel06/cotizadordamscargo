import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./tipos";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/** Cliente de Supabase para Server Components, Server Actions y Route Handlers. */
export async function crearClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // En Server Components no se pueden escribir cookies; el proxy refresca la sesión.
          }
        },
      },
    },
  );
}

/** Usuario actual o redirección a /login. */
export async function usuarioRequerido() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  return { supabase, usuario: data.user };
}
