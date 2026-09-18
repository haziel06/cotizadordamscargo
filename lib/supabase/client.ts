"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export function crearClienteNavegador() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
