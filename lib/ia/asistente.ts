import type { Sesion } from "@/lib/sesion";
import { herramientasDisponibles } from "./herramientas";
import { generarConHerramientas } from "./router";
import { CONOCIMIENTO_EMPRESA } from "./conocimientoEmpresa";
import type { AdjuntoChat, MensajeIA } from "./tipos";

const MAX_HISTORIAL = 8;

function promptSistema(sesion: Sesion): string {
  const reglas = [
    "Eres el asistente interno de Dams Cargo, una agencia de aduanas y logística en Guatemala.",
    `Hablas con ${sesion.nombre || sesion.email}, quien es ${sesion.esAdmin ? "administrador" : "usuario"} del sistema.`,
    "Respondes en español, de forma breve y concreta, usando SIEMPRE las herramientas disponibles para obtener datos reales del sistema (cotizaciones, tarifas, proveedores).",
    "Nunca inventes números, clientes ni precios: si una herramienta no encuentra algo, dilo así.",
    "Puedes crear cotizaciones con la herramienta crearCotizacion cuando el empleado lo pida: reúne primero los datos que falten (cliente, servicio y, en courier, peso y si es ticket o consolidado), hazle una sola pregunta con todo lo que falta, y al tenerlos créala sin pedir más confirmaciones. Tras crearla, di el número y el total; los botones de PDF y editor aparecen solos debajo de tu mensaje.",
    !sesion.esAdmin
      ? "Este usuario NO es administrador: nunca menciones costos, márgenes ni utilidad aunque los infieras: solo precios de venta."
      : "Este usuario es administrador: puede ver costos, márgenes y utilidad si los pide.",
  ].join(" ");
  return `${reglas}\n\nAdemás de las herramientas, usa este conocimiento de la empresa para responder preguntas generales, de servicio al cliente o sobre cómo funciona un servicio (nunca para inventar tarifas, esas siempre vienen de las herramientas):\n${CONOCIMIENTO_EMPRESA}`;
}

export interface MensajeChat { role: "user" | "assistant"; content: string; adjuntos?: AdjuntoChat[] }

/** Responde al empleado usando el historial reciente y las herramientas (consultas y creación de cotizaciones). */
export async function preguntarAsistente(sesion: Sesion, historial: MensajeChat[]): Promise<{ texto: string; adjuntos: AdjuntoChat[] }> {
  const recientes = historial.slice(-MAX_HISTORIAL);
  const mensajes: MensajeIA[] = [
    { role: "system", content: promptSistema(sesion) },
    ...recientes.map((m): MensajeIA => ({ role: m.role, content: m.content })),
  ];
  return generarConHerramientas({
    mensajes,
    herramientas: herramientasDisponibles(sesion.esAdmin),
    contexto: { sesion, adjuntos: [] },
  });
}
