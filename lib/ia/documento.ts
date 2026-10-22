import readXlsx from "read-excel-file/node";

/** Un archivo listo para Gemini: foto/PDF viajan en base64; Excel y CSV se convierten a texto tabulado. */
export interface DocumentoIA {
  nombre: string;
  base64?: string;
  mimeType?: string;
  texto?: string;
}

// Vercel solo deja pasar ~4.5 MB por envío; las fotos grandes ya se reducen en el navegador.
export const MAX_BYTES_DOCUMENTO = 4 * 1024 * 1024;
const MAX_CARACTERES_TEXTO = 400_000;
const IMAGENES_Y_PDF = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export async function prepararDocumento(archivo: File): Promise<{ ok: true; doc: DocumentoIA } | { ok: false; error: string }> {
  if (archivo.size === 0) return { ok: false, error: "El archivo está vacío." };
  if (archivo.size > MAX_BYTES_DOCUMENTO) return { ok: false, error: "El archivo pesa más de 4 MB. Si es un PDF, súbelo por partes; las fotos se reducen solas." };
  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "";
  const buffer = Buffer.from(await archivo.arrayBuffer());

  if (IMAGENES_Y_PDF.includes(archivo.type)) return { ok: true, doc: { nombre: archivo.name, base64: buffer.toString("base64"), mimeType: archivo.type } };

  if (ext === "xlsx" || archivo.type.includes("spreadsheetml")) {
    try {
      const hojas = await readXlsx(buffer);
      const texto = hojas
        .map((h) => `### Hoja: ${h.sheet}\n${h.data.map((fila) => fila.map((c) => (c == null ? "" : String(c))).join("\t")).join("\n")}`)
        .join("\n\n")
        .slice(0, MAX_CARACTERES_TEXTO);
      if (!texto.trim()) return { ok: false, error: "El Excel no tiene datos legibles." };
      return { ok: true, doc: { nombre: archivo.name, texto } };
    } catch {
      return { ok: false, error: "No pude abrir ese Excel. Guárdalo como .xlsx (no .xls) e inténtalo de nuevo." };
    }
  }

  if (ext === "csv" || archivo.type === "text/csv") return { ok: true, doc: { nombre: archivo.name, texto: buffer.toString("utf-8").slice(0, MAX_CARACTERES_TEXTO) } };

  return { ok: false, error: "Solo PDF, foto (PNG, JPG, WEBP), Excel (.xlsx) o CSV." };
}
