/**
 * URL y llave pública (anon) del proyecto Supabase.
 *
 * No son secretas: el prefijo NEXT_PUBLIC_ existe justo porque van embebidas en el bundle
 * del navegador. La seguridad real la dan las políticas de RLS de Supabase (solo usuarios
 * autenticados pueden leer/escribir). Se leen de variables de entorno si existen, y si no,
 * caen en los valores del proyecto `dams-cargo-cotizador` para que la app funcione igual
 * en Vercel aunque no se hayan configurado ahí.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://skwucjiiatqxvtozexpm.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_JZaRoGwG5wSBUMMoRwi4aQ_duB2Ah6h";
