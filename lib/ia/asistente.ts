import type { Sesion } from "@/lib/sesion";
import { herramientasDisponibles } from "./herramientas";
import { generarConHerramientas } from "./router";
import type { MensajeIA } from "./tipos";

const MAX_HISTORIAL = 8;

function promptSistema(sesion: Sesion): string {
  return [
    "Eres el asistente interno de Dams Cargo, una agencia de aduanas y logística en Guatemala.",
    `Hablas con ${sesion.nombre || sesion.email}, quien es ${sesion.esAdmin ? "administrador" : "usuario"} del sistema.`,
    "Respondes en español, de forma breve y concreta, usando SIEMPRE las herramientas disponibles para obtener datos reales del sistema.",
    "Nunca inventes números, clientes ni precios: si una herramienta no encuentra algo, dilo así.",
    !sesion.esAdmin
      ? "Este usuario NO es administrador: nunca menciones costos, márgenes ni utilidad aunque los infieras: solo precios de venta."
      : "Este usuario es administrador: puede ver costos, márgenes y utilidad si los pide.",
  ].join(" ");
}

export interface MensajeChat { role: "user" | "assistant"; content: string }

/** Responde una pregunta del empleado usando el historial reciente y las herramientas de solo lectura. */
export async function preguntarAsistente(sesion: Sesion, historial: MensajeChat[]): Promise<string> {
  const recientes = historial.slice(-MAX_HISTORIAL);
  const mensajes: MensajeIA[] = [
    { role: "system", content: promptSistema(sesion) },
    ...recientes.map((m): MensajeIA => ({ role: m.role, content: m.content })),
  ];
  const { texto } = await generarConHerramientas({
    mensajes,
    herramientas: herramientasDisponibles(sesion.esAdmin),
    contexto: { sesion },
  });
  return texto;
}
