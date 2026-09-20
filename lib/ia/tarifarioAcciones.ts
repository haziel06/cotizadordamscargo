"use server";
import { sesionActual } from "@/lib/sesion";
import { extraerTarifarioDeDocumento, type ExtraccionTarifario } from "./tarifarioIA";

export type ResultadoExtraccion = { ok: true; datos: ExtraccionTarifario } | { ok: false; error: string };

const TIPOS_ACEPTADOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

/** Solo administradores: lee un PDF/foto de tarifario y devuelve filas sugeridas SIN guardar nada todavía. */
export async function extraerTarifarioIA(form: FormData): Promise<ResultadoExtraccion> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede usar esto." };

  const archivo = form.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "Elige un archivo." };
  if (archivo.size > MAX_BYTES) return { ok: false, error: "Máximo 15 MB." };
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) return { ok: false, error: "Solo PDF, PNG, JPG o WEBP." };

  try {
    const buffer = Buffer.from(await archivo.arrayBuffer());
    const datos = await extraerTarifarioDeDocumento(buffer.toString("base64"), archivo.type);
    return { ok: true, datos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el documento." };
  }
}
