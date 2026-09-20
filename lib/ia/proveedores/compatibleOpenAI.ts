import { ErrorProveedorIA, type AIProvider, type HerramientaIA, type LlamadaHerramienta, type MensajeIA, type ResultadoGeneracion } from "../tipos";

/**
 * Groq y OpenRouter exponen la misma forma de API (compatible con OpenAI "chat completions"
 * con tools). Esta base evita duplicar el parseo de la respuesta entre ambos adaptadores.
 */
export function crearProveedorCompatibleOpenAI(opciones: {
  nombre: string;
  urlBase: string;
  apiKey: string | undefined;
  modelo: string;
  timeoutMs?: number;
}): AIProvider {
  const { nombre, urlBase, apiKey, modelo, timeoutMs = 20_000 } = opciones;

  async function generar(mensajes: MensajeIA[], herramientas?: HerramientaIA[]): Promise<ResultadoGeneracion> {
    if (!apiKey) throw new ErrorProveedorIA(`${nombre}: falta la API key en el servidor.`, "sin_configurar", nombre);

    const cuerpo: Record<string, unknown> = {
      model: modelo,
      messages: mensajes.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls ? { tool_calls: m.tool_calls.map(aFormatoOpenAI) } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      })),
    };
    if (herramientas?.length) {
      cuerpo.tools = herramientas.map((h) => ({
        type: "function",
        function: { name: h.nombre, description: h.descripcion, parameters: h.parametros },
      }));
    }

    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(`${urlBase}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new ErrorProveedorIA(`${nombre}: tiempo de espera agotado.`, "timeout", nombre);
      throw new ErrorProveedorIA(`${nombre}: no se pudo conectar (${(e as Error).message}).`, "error_proveedor", nombre);
    } finally {
      clearTimeout(corte);
    }

    if (resp.status === 429) throw new ErrorProveedorIA(`${nombre}: límite de uso alcanzado.`, "rate_limit", nombre);
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new ErrorProveedorIA(`${nombre}: respondió ${resp.status} ${texto.slice(0, 200)}`, "error_proveedor", nombre);
    }

    const datos = await resp.json();
    const mensaje = datos?.choices?.[0]?.message;
    if (!mensaje) throw new ErrorProveedorIA(`${nombre}: respuesta sin contenido.`, "error_proveedor", nombre);

    const toolCalls: LlamadaHerramienta[] = (mensaje.tool_calls ?? []).map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      nombre: tc.function.name,
      argumentos: parsearArgumentos(tc.function.arguments),
    }));

    return {
      texto: mensaje.content ?? "",
      toolCalls,
      tokensEntrada: datos?.usage?.prompt_tokens ?? 0,
      tokensSalida: datos?.usage?.completion_tokens ?? 0,
    };
  }

  return { nombre, modelo, soportaHerramientas: true, soportaVision: false, generar };
}

function aFormatoOpenAI(tc: LlamadaHerramienta) {
  return { id: tc.id, type: "function" as const, function: { name: tc.nombre, arguments: JSON.stringify(tc.argumentos) } };
}

function parsearArgumentos(texto: string): Record<string, unknown> {
  try {
    return JSON.parse(texto || "{}");
  } catch {
    return {};
  }
}
