import { ErrorProveedorIA, type AIProvider, type HerramientaIA, type LlamadaHerramienta, type MensajeIA, type ResultadoGeneracion } from "../tipos";

const NOMBRE = "Gemini";
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type ParteGemini = Record<string, unknown>;
interface ContenidoGemini { role: "user" | "model"; parts: ParteGemini[] }

function parsearJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/**
 * Convierte la conversación interna al formato de Gemini. Dos reglas del API que importan:
 * - los resultados de varias herramientas consecutivas van juntos en UN solo turno de usuario;
 * - el turno del modelo con llamadas a herramientas se reenvía tal cual lo devolvió (`partes_crudas`),
 *   porque Gemini 3 valida las firmas de razonamiento que vienen dentro de esas partes.
 */
export function aContenidosGemini(mensajes: MensajeIA[]): ContenidoGemini[] {
  const contenidos: ContenidoGemini[] = [];
  for (const m of mensajes) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      contenidos.push({ role: "user", parts: [{ text: m.content }] });
    } else if (m.role === "assistant") {
      const partes = (m.partes_crudas as ParteGemini[] | undefined) ?? [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.tool_calls ?? []).map((tc) => ({ functionCall: { name: tc.nombre, args: tc.argumentos } })),
      ];
      if (partes.length) contenidos.push({ role: "model", parts: partes });
    } else {
      const parte: ParteGemini = { functionResponse: { name: m.nombre ?? "herramienta", response: { resultado: parsearJson(m.content) } } };
      const ultimo = contenidos[contenidos.length - 1];
      if (ultimo?.role === "user" && ultimo.parts.every((p) => "functionResponse" in p)) ultimo.parts.push(parte);
      else contenidos.push({ role: "user", parts: [parte] });
    }
  }
  return contenidos;
}

function aDeclaraciones(herramientas: HerramientaIA[]) {
  return herramientas.map((h) => {
    const props = (h.parametros as { properties?: Record<string, unknown> }).properties;
    // Gemini rechaza un objeto de parámetros sin propiedades: una herramienta sin argumentos va sin `parameters`.
    return { name: h.nombre, description: h.descripcion, ...(props && Object.keys(props).length ? { parameters: h.parametros } : {}) };
  });
}

/**
 * Único proveedor de IA de la app: texto con herramientas (asistente), y lectura de fotos/PDF
 * (`extraerJsonDeDocumento`). Modelo configurable: revisar https://ai.google.dev/gemini-api/docs/models
 * antes de fijar otro (Google retira los viejos y el error dice a cuál pasar).
 */
export function crearGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelo = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  async function generar(mensajes: MensajeIA[], herramientas?: HerramientaIA[]): Promise<ResultadoGeneracion> {
    if (!apiKey) throw new ErrorProveedorIA(`${NOMBRE}: falta la API key en el servidor.`, "sin_configurar", NOMBRE);

    const sistema = mensajes.find((m) => m.role === "system")?.content;
    const cuerpo = {
      contents: aContenidosGemini(mensajes),
      ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}),
      ...(herramientas?.length ? { tools: [{ functionDeclarations: aDeclaraciones(herramientas) }] } : {}),
      generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
    };

    let resp: Response;
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 45_000);
    try {
      resp = await fetch(`${URL_BASE}/${modelo}:generateContent?key=${apiKey}`, {
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

    if (resp.status === 429) throw new ErrorProveedorIA(`${NOMBRE}: límite de uso alcanzado.`, "rate_limit", NOMBRE);
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      throw new ErrorProveedorIA(`${NOMBRE}: respondió ${resp.status} ${texto.slice(0, 300)}`, "error_proveedor", NOMBRE);
    }

    const datos = await resp.json();
    const partes: ParteGemini[] = datos?.candidates?.[0]?.content?.parts ?? [];
    const texto = partes.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text as string).join("");
    const toolCalls: LlamadaHerramienta[] = partes
      .filter((p) => p.functionCall)
      .map((p, i) => {
        const fc = p.functionCall as { id?: string; name: string; args?: Record<string, unknown> };
        return { id: fc.id ?? `llamada-${Date.now()}-${i}`, nombre: fc.name, argumentos: fc.args ?? {} };
      });

    return {
      texto,
      toolCalls,
      tokensEntrada: datos?.usageMetadata?.promptTokenCount ?? 0,
      tokensSalida: datos?.usageMetadata?.candidatesTokenCount ?? 0,
      partesCrudas: partes,
    };
  }

  return { nombre: NOMBRE, modelo, soportaHerramientas: true, soportaVision: true, generar };
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
  /** Contenido ya en texto (Excel/CSV convertidos); alternativa a `archivoBase64`. */
  texto?: string;
  esquemaJson: Record<string, unknown>;
  /** Tope de tokens de salida; las hojas de tarifas largas necesitan bastante más que un formulario. */
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelo = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  if (!apiKey) throw new ErrorProveedorIA(`${NOMBRE}: falta la API key en el servidor.`, "sin_configurar", NOMBRE);

  const partes: Record<string, unknown>[] = [{ text: opciones.instruccion }];
  if (opciones.archivoBase64 && opciones.mimeType) partes.push({ inline_data: { mime_type: opciones.mimeType, data: opciones.archivoBase64 } });
  if (opciones.texto) partes.push({ text: `CONTENIDO DEL ARCHIVO (tabulado por hojas):\n${opciones.texto}` });

  const cuerpo = {
    contents: [{ role: "user", parts: partes }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opciones.esquemaJson,
      maxOutputTokens: opciones.maxTokens ?? 8192,
      // Sin esto, el modelo gasta su presupuesto de salida "pensando" antes de escribir el JSON:
      // con documentos largos eso truncaba la lista a una sola fila, y a veces ni terminaba (503).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const intentar = async (): Promise<Response> => {
    const control = new AbortController();
    const corte = setTimeout(() => control.abort(), 55_000);
    try {
      return await fetch(`${URL_BASE}/${modelo}:generateContent?key=${apiKey}`, {
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
    // Reintentar no sirve: el documento simplemente no cabe en una sola lectura.
    if (datos?.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      throw new ErrorProveedorIA(`${NOMBRE}: el documento es tan largo que la lectura se cortó.`, "error_proveedor", NOMBRE);
    }
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
