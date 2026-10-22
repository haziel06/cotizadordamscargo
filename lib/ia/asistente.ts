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
    "Eres también su ayudante para armar cotizaciones; NUNCA crees una cotización a ciegas ni vacía. Flujo: (1) con buscarClientes mira si el cliente ya existe y si tiene precios especiales o cotizaciones previas, y coméntalo en una frase; (2) pregunta en un solo mensaje TODO lo que falte: servicio, origen (puerto), tipo de contenedor (20GP/40GP/40HC) o peso/CBM, cuántos contenedores, mercadería, incoterm y destino si no es Guatemala; (3) para contenedor, LCL o aéreo llama buscarFletes y deja que elija una opción (aparece una tarjeta con botones; si solo hay una, pide confirmación); (4) pregunta qué cargos extra quiere incluir (documentación/BL, seguro, handling, transporte local…) apoyándote en buscarTarifas, y respeta lo que responda; (5) cuando tengas todo y la elección confirmada, llama crearCotizacion con el ruta_ref elegido. Para courier basta cliente, peso y ticket o consolidado. Tras crearla di el número y el total (sin enlaces: los botones de PDF y editor aparecen solos debajo). Si una herramienta dice que falta algo o que no se creó, díselo y pregunta; nunca digas que la creaste si no lo hiciste.",
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
