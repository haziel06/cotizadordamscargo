import type { Sesion } from "@/lib/sesion";
import type { PropuestaActualizacion } from "@/lib/tarifas/diferencias";
import type { DocumentoIA } from "./documento";

export type RolMensaje = "system" | "user" | "assistant" | "tool";

export interface LlamadaHerramienta {
  id: string;
  nombre: string;
  argumentos: Record<string, unknown>;
}

export interface MensajeIA {
  role: RolMensaje;
  content: string;
  /** Solo en mensajes "assistant" que piden ejecutar herramientas. */
  tool_calls?: LlamadaHerramienta[];
  /** Solo en mensajes "assistant": partes tal como las devolvió el modelo (Gemini exige reenviarlas intactas, con sus firmas de razonamiento). */
  partes_crudas?: unknown[];
  /** Solo en mensajes "tool": a qué llamada responde. */
  tool_call_id?: string;
  /** Solo en mensajes "tool": nombre de la herramienta que respondió. */
  nombre?: string;
}

/** Algo que el asistente produjo y que la interfaz debe mostrar como botón (hoy: una cotización lista con su PDF). */
export interface OpcionChat { ref: string; etiqueta: string; detalle: string; precio: string }

export type AdjuntoChat =
  | { tipo: "cotizacion"; id: string; numero: string; cliente: string; total: string }
  /** Tarjeta con opciones para elegir con un clic (ej. los fletes de cada proveedor): el clic manda la elección como mensaje. */
  | { tipo: "opciones_flete"; titulo: string; opciones: OpcionChat[] }
  /** Cambios propuestos a un tarifario a partir de un archivo; solo se aplican cuando el administrador los revisa y confirma. */
  | { tipo: "actualizacion_tarifa"; tarifarioId: string; tarifarioNombre: string; nuevos: number; cambian: number; iguales: number; propuesta?: PropuestaActualizacion };

export interface ContextoHerramienta {
  sesion: Sesion;
  /** Las herramientas que producen algo descargable lo agregan aquí; el router lo devuelve junto al texto. */
  adjuntos: AdjuntoChat[];
  /** Archivo que el empleado adjuntó a este mensaje (foto, PDF, Excel), ya preparado para la IA. */
  archivo?: DocumentoIA;
}

export interface HerramientaIA {
  nombre: string;
  descripcion: string;
  /** JSON Schema de los parámetros (formato OpenAI function calling). */
  parametros: Record<string, unknown>;
  ejecutar: (argumentos: Record<string, unknown>, contexto: ContextoHerramienta) => Promise<unknown>;
}

export interface ResultadoGeneracion {
  texto: string;
  toolCalls: LlamadaHerramienta[];
  tokensEntrada: number;
  tokensSalida: number;
  partesCrudas?: unknown[];
}

export class ErrorProveedorIA extends Error {
  constructor(
    message: string,
    public tipo: "rate_limit" | "timeout" | "error_proveedor" | "sin_configurar",
    public proveedor: string,
  ) {
    super(message);
    this.name = "ErrorProveedorIA";
  }
}

/** Adaptador común: cada proveedor implementa esto y el router no depende de ninguno en particular. */
export interface AIProvider {
  nombre: string;
  modelo: string;
  soportaHerramientas: boolean;
  soportaVision: boolean;
  generar(mensajes: MensajeIA[], herramientas?: HerramientaIA[]): Promise<ResultadoGeneracion>;
}
