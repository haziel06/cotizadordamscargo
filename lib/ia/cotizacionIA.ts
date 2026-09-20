import { z } from "zod";
import { extraerJsonDeDocumento } from "./proveedores/gemini";

const ESQUEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    tipo_servicio_sugerido: { type: "STRING", enum: ["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"] },
    cliente_nombre: { type: "STRING" },
    contacto: { type: "STRING" },
    telefono: { type: "STRING" },
    origen: { type: "STRING" },
    destino: { type: "STRING" },
    tipo_carga: { type: "STRING" },
    kilogramos: { type: "NUMBER" },
    bultos: { type: "NUMBER" },
    medidas: { type: "STRING" },
    mercaderia: { type: "STRING" },
    valor_mercaderia: { type: "NUMBER" },
    notas_internas: { type: "STRING" },
  },
  required: ["tipo_servicio_sugerido"],
};

const esquemaCabecera = z.object({
  tipo_servicio_sugerido: z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"]).nullable().optional().default(null),
  cliente_nombre: z.string().trim().optional().default(""),
  contacto: z.string().trim().optional().default(""),
  telefono: z.string().trim().optional().default(""),
  origen: z.string().trim().optional().default(""),
  destino: z.string().trim().optional().default(""),
  tipo_carga: z.string().trim().optional().default(""),
  kilogramos: z.coerce.number().nullable().optional().default(null),
  bultos: z.coerce.number().nullable().optional().default(null),
  medidas: z.string().trim().optional().default(""),
  mercaderia: z.string().trim().optional().default(""),
  valor_mercaderia: z.coerce.number().nullable().optional().default(null),
  notas_internas: z.string().trim().optional().default(""),
});
export type CabeceraExtraida = z.infer<typeof esquemaCabecera>;

const INSTRUCCION = [
  "Eres un asistente que arma el encabezado de una cotización de carga/logística en Guatemala a partir de lo que el empleado te describe o de un documento que adjunta (factura, packing list, captura de un pedido de Amazon, correo del cliente, etc.).",
  "Extrae SOLO los datos que estén explícitos en el texto o el documento; deja vacío o nulo lo que no se mencione, nunca inventes cifras ni nombres.",
  "'tipo_servicio_sugerido' es tu mejor estimación del tipo de servicio (marítimo, aéreo, courier, terrestre, trámite aduanal) según lo descrito.",
  "Responde SOLO con el JSON pedido.",
].join(" ");

/** Extrae el encabezado de una cotización desde texto libre y/o un documento adjunto (foto/PDF). */
export async function extraerCabeceraCotizacion(opciones: { descripcion?: string; archivoBase64?: string; mimeType?: string }): Promise<CabeceraExtraida> {
  const instruccion = opciones.descripcion ? `${INSTRUCCION}\n\nEl empleado describió: "${opciones.descripcion}"` : INSTRUCCION;
  const textoJson = await extraerJsonDeDocumento({ instruccion, archivoBase64: opciones.archivoBase64, mimeType: opciones.mimeType, esquemaJson: ESQUEMA_GEMINI });
  let bruto: unknown;
  try {
    bruto = JSON.parse(textoJson);
  } catch {
    throw new Error("La IA no devolvió un JSON válido. Intenta describirlo de nuevo o con una foto más clara.");
  }
  const parsed = esquemaCabecera.safeParse(bruto);
  if (!parsed.success) throw new Error("No se pudo interpretar la información.");
  return parsed.data;
}
