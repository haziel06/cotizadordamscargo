"use server";
import { sesionActual } from "@/lib/sesion";
import { extraerCabeceraCotizacion, type CabeceraExtraida } from "./cotizacionIA";

export type ResultadoCabecera = { ok: true; datos: CabeceraExtraida } | { ok: false; error: string };

const TIPOS_ACEPTADOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

/** Arma el encabezado de una cotización desde una descripción y/o un documento adjunto. Nunca guarda nada por sí sola. */
export async function extraerCabeceraIA(form: FormData): Promise<ResultadoCabecera> {
  const sesion = await sesionActual();
  if (!sesion || !sesion.activo) return { ok: false, error: "Sesión vencida." };

  const descripcion = String(form.get("descripcion") ?? "").trim().slice(0, 1000);
  const archivo = form.get("archivo");
  const tieneArchivo = archivo instanceof File && archivo.size > 0;
  if (!descripcion && !tieneArchivo) return { ok: false, error: "Describe el envío o adjunta un documento." };

  if (tieneArchivo) {
    if ((archivo as File).size > MAX_BYTES) return { ok: false, error: "Máximo 15 MB." };
    if (!TIPOS_ACEPTADOS.includes((archivo as File).type)) return { ok: false, error: "Solo PDF, PNG, JPG o WEBP." };
  }

  try {
    const buffer = tieneArchivo ? Buffer.from(await (archivo as File).arrayBuffer()) : null;
    const datos = await extraerCabeceraCotizacion({
      descripcion: descripcion || undefined,
      archivoBase64: buffer?.toString("base64"),
      mimeType: tieneArchivo ? (archivo as File).type : undefined,
    });
    return { ok: true, datos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo interpretar la información." };
  }
}
