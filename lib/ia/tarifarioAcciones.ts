"use server";
import { sesionActual } from "@/lib/sesion";
import { prepararDocumento } from "./documento";
import { extraerTarifarioDeDocumento, type ExtraccionTarifario } from "./tarifarioIA";

export type ResultadoExtraccion = { ok: true; datos: ExtraccionTarifario } | { ok: false; error: string };

/** Solo administradores: lee un PDF/foto/Excel de tarifario y devuelve filas sugeridas SIN guardar nada todavía. */
export async function extraerTarifarioIA(form: FormData): Promise<ResultadoExtraccion> {
  const sesion = await sesionActual();
  if (!sesion?.esAdmin) return { ok: false, error: "Solo un administrador puede usar esto." };

  const archivo = form.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, error: "Elige un archivo." };
  const preparado = await prepararDocumento(archivo);
  if (!preparado.ok) return preparado;

  try {
    return { ok: true, datos: await extraerTarifarioDeDocumento(preparado.doc) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer el documento." };
  }
}
