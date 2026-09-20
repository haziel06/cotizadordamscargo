"use server";
import { z } from "zod";
import { sesionActual } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/tipos";
import { preguntarAsistente, type MensajeChat } from "./asistente";

const esquemaHistorial = z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).min(1).max(20);
const MAX_CONVERSACIONES = 10;

export type RespuestaAsistente = { ok: true; texto: string } | { ok: false; error: string };

export async function preguntarIA(historial: unknown): Promise<RespuestaAsistente> {
  const parsed = esquemaHistorial.safeParse(historial);
  if (!parsed.success) return { ok: false, error: "Mensaje inválido." };

  const sesion = await sesionActual();
  if (!sesion || !sesion.activo) return { ok: false, error: "Sesión vencida." };

  try {
    const texto = await preguntarAsistente(sesion, parsed.data as MensajeChat[]);
    return { ok: true, texto };
  } catch {
    return { ok: false, error: "No pude conectarme con el asistente en este momento. Intenta de nuevo en un momento." };
  }
}

export interface ResumenConversacion { id: string; titulo: string; updated_at: string }

/** Últimas conversaciones del usuario en sesión (nunca las de otro: RLS las limita a las propias). */
export async function listarConversacionesIA(): Promise<ResumenConversacion[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("ia_conversaciones").select("id, titulo, updated_at").order("updated_at", { ascending: false }).limit(MAX_CONVERSACIONES);
  return data ?? [];
}

export async function cargarConversacionIA(id: string): Promise<MensajeChat[] | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("ia_conversaciones").select("mensajes").eq("id", id).maybeSingle();
  return (data?.mensajes as MensajeChat[] | undefined) ?? null;
}

/** Guarda/actualiza la conversación y recorta a las últimas 10 del usuario. */
export async function guardarConversacionIA(id: string | null, mensajes: MensajeChat[]): Promise<{ ok: true; id: string } | { ok: false }> {
  const sesion = await sesionActual();
  if (!sesion) return { ok: false };
  const supabase = await crearClienteServidor();
  const titulo = (mensajes.find((m) => m.role === "user")?.content ?? "Conversación").slice(0, 60);
  const fila = { user_id: sesion.userId, titulo, mensajes: mensajes as unknown as Json, updated_at: new Date().toISOString() };

  const q = id && /^[0-9a-f-]{36}$/i.test(id)
    ? supabase.from("ia_conversaciones").update(fila).eq("id", id).select("id").single()
    : supabase.from("ia_conversaciones").insert(fila).select("id").single();
  const { data, error } = await q;
  if (error || !data) return { ok: false };

  const { data: viejas } = await supabase.from("ia_conversaciones").select("id").order("updated_at", { ascending: false }).range(MAX_CONVERSACIONES, 999);
  if (viejas?.length) await supabase.from("ia_conversaciones").delete().in("id", viejas.map((v) => v.id));

  return { ok: true, id: data.id };
}

export async function eliminarConversacionIA(id: string): Promise<{ ok: boolean }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("ia_conversaciones").delete().eq("id", id);
  return { ok: !error };
}
