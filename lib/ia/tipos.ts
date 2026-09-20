import type { Sesion } from "@/lib/sesion";

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
  /** Solo en mensajes "tool": a qué llamada responde. */
  tool_call_id?: string;
}

export interface ContextoHerramienta {
  sesion: Sesion;
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
