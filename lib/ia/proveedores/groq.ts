import { crearProveedorCompatibleOpenAI } from "./compatibleOpenAI";

/**
 * Proveedor principal para preguntas normales y function calling (nivel gratuito generoso).
 * Modelo configurable por si Groq cambia su catálogo; revisar https://console.groq.com/docs/models.
 */
export function crearGroqProvider() {
  return crearProveedorCompatibleOpenAI({
    nombre: "Groq",
    urlBase: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    modelo: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  });
}
