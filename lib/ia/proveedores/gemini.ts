import { ErrorProveedorIA, type AIProvider, type MensajeIA, type ResultadoGeneracion } from "../tipos";

const NOMBRE = "Gemini";

/**
 * Reservado para lo multimodal (fotos/PDF de tarifarios) que vendrá después: Groq y OpenRouter
 * no leen imágenes. Sin `tools` propias todavía; el router solo lo usa para tareas de visión.
 * Modelo configurable: revisar https://ai.google.dev/gemini-api/docs/models antes de fijar otro.
 */
export function crearGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelo = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  async function generar(mensajes: MensajeIA[]): Promise<ResultadoGeneracion> {
    if (!apiKey) throw new ErrorProveedorIA(`${NOMBRE}: falta la API key en el servidor.`, "sin_configurar", NOMBRE);

    const sistema = mensajes.find((m) => m.role === "system")?.content;
    const contents = mensajes
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 30_000);
    let resp: Response;
    try {
      resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents, ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}) }),
        signal: control.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new ErrorProveedorIA(`${NOMBRE}: tiempo de espera agotado.`, "timeout", NOMBRE);
      throw new ErrorProveedorIA(`${NOMBRE}: no se pudo conectar (${(e as Error).message}).`, "error_proveedor", NOMBRE);
    } finally {
      clearTimeout(corte);
    }

    if (resp.status === 429) throw new ErrorProveedorIA(`${NOMBRE}: límite de uso alcanzado.`, "rate_limit", NOMBRE);
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new ErrorProveedorIA(`${NOMBRE}: respondió ${resp.status} ${texto.slice(0, 200)}`, "error_proveedor", NOMBRE);
    }

    const datos = await resp.json();
    const texto = datos?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return {
      texto,
      toolCalls: [],
      tokensEntrada: datos?.usageMetadata?.promptTokenCount ?? 0,
      tokensSalida: datos?.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  return { nombre: NOMBRE, modelo, soportaHerramientas: false, soportaVision: true, generar };
}

/**
 * Envía una foto/PDF a Gemini y pide un JSON con la forma exacta de `esquema` (Structured
 * Output de Gemini: https://ai.google.dev/gemini-api/docs/structured-output). El texto se
 * valida SIEMPRE con Zod del lado del servidor antes de usarse — nunca se confía ciego en el modelo.
 */
export async function extraerJsonDeDocumento(opciones: {
  instruccion: string;
  archivoBase64?: string;
  mimeType?: string;
  esquemaJson: Record<string, unknown>;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelo = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  if (!apiKey) throw new ErrorProveedorIA(`${NOMBRE}: falta la API key en el servidor.`, "sin_configurar", NOMBRE);

  const partes: Record<string, unknown>[] = [{ text: opciones.instruccion }];
  if (opciones.archivoBase64 && opciones.mimeType) partes.push({ inline_data: { mime_type: opciones.mimeType, data: opciones.archivoBase64 } });

  const cuerpo = {
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opciones.esquemaJson,
      maxOutputTokens: 8192,
      // Sin esto, el modelo gasta su presupuesto de salida "pensando" antes de escribir el JSON:
      // con documentos largos eso truncaba la lista a una sola fila, y a veces ni terminaba (503).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const intentar = async (): Promise<Response> => {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 60_000);
    try {
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw new ErrorProveedorIA(`${NOMBRE}: tiempo de espera agotado.`, "timeout", NOMBRE);
      throw new ErrorProveedorIA(`${NOMBRE}: no se pudo conectar (${(e as Error).message}).`, "error_proveedor", NOMBRE);
    } finally {
      clearTimeout(corte);
    }
  };

  // Gemini a veces responde 503 (saturado) o un JSON incompleto/mal formado de forma pasajera:
  // hasta 2 intentos en total evita que el usuario tenga que darle "Continuar" varias veces a mano.
  let ultimoError: ErrorProveedorIA | null = null;
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    if (vuelta > 0) await new Promise((r) => setTimeout(r, 1500));
    const resp = await intentar();
    if (resp.status === 429) throw new ErrorProveedorIA(`${NOMBRE}: límite de uso alcanzado.`, "rate_limit", NOMBRE);
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      ultimoError = new ErrorProveedorIA(`${NOMBRE}: respondió ${resp.status} ${texto.slice(0, 300)}`, "error_proveedor", NOMBRE);
      continue;
    }
    const datos = await resp.json();
    const texto = datos?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!texto) {
      ultimoError = new ErrorProveedorIA(`${NOMBRE}: no devolvió contenido (posible bloqueo de seguridad o documento demasiado largo).`, "error_proveedor", NOMBRE);
      continue;
    }
    try {
      JSON.parse(texto);
    } catch {
      ultimoError = new ErrorProveedorIA(`${NOMBRE}: devolvió un JSON incompleto.`, "error_proveedor", NOMBRE);
      continue;
    }
    return texto;
  }
  throw ultimoError ?? new ErrorProveedorIA(`${NOMBRE}: no se pudo completar la solicitud.`, "error_proveedor", NOMBRE);
}
