import { crearProveedorCompatibleOpenAI } from "./compatibleOpenAI";

/**
 * Respaldo cuando Groq falla o está saturado. Los modelos ":free" y sus límites cambian con
 * frecuencia; revisar https://openrouter.ai/models?max_price=0 antes de fijar uno distinto.
 */
export function crearOpenRouterProvider() {
  return crearProveedorCompatibleOpenAI({
    nombre: "OpenRouter",
    urlBase: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    modelo: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
  });
}
