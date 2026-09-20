import { z } from "zod";
import { extraerJsonDeDocumento } from "./proveedores/gemini";

/** Esquema que le pedimos a Gemini (formato Structured Output: mayúsculas tipo OpenAPI). */
const ESQUEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    proveedor_sugerido: { type: "STRING", description: "Nombre del proveedor/naviera/courier que aparece en el documento, si se ve" },
    servicio_sugerido: { type: "STRING", enum: ["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"] },
    moneda_sugerida: { type: "STRING", enum: ["USD", "GTQ"] },
    vigencia_desde: { type: "STRING", description: "Fecha de inicio de validez de la tarifa, en formato AAAA-MM-DD, si el documento la menciona" },
    vigencia_hasta: { type: "STRING", description: "Fecha de fin de validez, en formato AAAA-MM-DD, si el documento la menciona" },
    filas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["ruta", "concepto"], description: "'ruta' si es un tramo origen→destino (flete), 'concepto' si es un cargo fijo con nombre (ej. 'Documentación', 'BL', 'Manejo')" },
          nombre: { type: "STRING", description: "Nombre del cargo (solo para 'concepto')" },
          origen: { type: "STRING" },
          destino: { type: "STRING" },
          via: { type: "STRING", description: "Puerto de trasbordo si aplica" },
          costo: { type: "NUMBER", description: "Costo/tarifa tal como aparece en el documento, sin margen" },
          unidad: { type: "STRING", enum: ["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"] },
          minimo: { type: "NUMBER", description: "Cobro mínimo si el documento lo menciona" },
          transito: { type: "STRING", description: "Días de tránsito si aparecen" },
          notas: { type: "STRING" },
        },
        required: ["tipo", "costo"],
      },
    },
  },
  required: ["filas"],
};

const esquemaFila = z.object({
  tipo: z.enum(["ruta", "concepto"]),
  nombre: z.string().trim().optional().default(""),
  origen: z.string().trim().optional().default(""),
  destino: z.string().trim().optional().default(""),
  via: z.string().trim().optional().default(""),
  costo: z.coerce.number().min(0),
  unidad: z.enum(["envio", "contenedor", "kg", "cbm", "libra", "pie_cubico", "guia", "factura"]).optional().default("envio"),
  minimo: z.coerce.number().min(0).nullable().optional().default(null),
  transito: z.string().trim().optional().default(""),
  notas: z.string().trim().optional().default(""),
});

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().default("").catch("");
const esquemaExtraccion = z.object({
  proveedor_sugerido: z.string().trim().optional().default(""),
  servicio_sugerido: z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"]).nullable().optional().default(null),
  moneda_sugerida: z.enum(["USD", "GTQ"]).optional().default("USD"),
  vigencia_desde: fechaIso,
  vigencia_hasta: fechaIso,
  filas: z.array(esquemaFila).min(1, "No se encontraron tarifas legibles en el documento."),
});

export type FilaExtraida = z.infer<typeof esquemaFila>;
export type ExtraccionTarifario = z.infer<typeof esquemaExtraccion>;

const INSTRUCCION = [
  "Eres un asistente que lee hojas de tarifas de proveedores de logística (navieras, couriers, transportistas) en Guatemala.",
  "Extrae CADA tarifa/tramo/cargo que veas en el documento como una fila, en el idioma original de los números (no traduzcas nombres propios).",
  "Usa 'ruta' para tramos con origen y destino (fletes marítimos/aéreos por trayecto).",
  "Usa 'concepto' para cargos fijos con nombre propio que no dependen de una ruta (documentación, manejo, BL, etc.).",
  "El 'costo' es el número tal como aparece en el documento, SIN agregar margen ni impuestos: solo transcribe.",
  "Si el documento menciona un periodo de validez/vigencia (ej. 'válido del 15 al 30 de septiembre de 2026'), conviértelo a 'vigencia_desde' y 'vigencia_hasta' en formato AAAA-MM-DD.",
  "Si un dato no aparece en el documento, deja el campo vacío o nulo: nunca inventes cifras ni fechas.",
  "Responde SOLO con el JSON pedido.",
].join(" ");

const PALABRAS_GENERICAS = new Set([
  "logistics", "logistica", "cargo", "courier", "freight", "shipping", "lines", "line", "group",
  "corp", "corporation", "company", "express", "internacional", "international", "guatemala",
]);

function palabrasClave(nombre: string): string[] {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !PALABRAS_GENERICAS.has(w));
}

/**
 * Empareja el proveedor sugerido por la IA con uno ya registrado por palabras clave en común,
 * ignorando términos genéricos ("logistics", "cargo"...): "Charter Link" sí calza con
 * "Charter League Logistics" (comparten "charter"), aunque el nombre completo no sea igual.
 */
export function coincideProveedor<T extends { nombre: string }>(sugerido: string, proveedores: T[]): T | undefined {
  const palabrasSugerido = new Set(palabrasClave(sugerido));
  if (!palabrasSugerido.size) return undefined;
  let mejor: { p: T; puntaje: number } | undefined;
  for (const p of proveedores) {
    const puntaje = palabrasClave(p.nombre).filter((w) => palabrasSugerido.has(w)).length;
    if (puntaje > 0 && (!mejor || puntaje > mejor.puntaje)) mejor = { p, puntaje };
  }
  return mejor?.p;
}

/** Llama a Gemini con el PDF/foto en base64 y valida la respuesta con Zod antes de devolverla. */
export async function extraerTarifarioDeDocumento(archivoBase64: string, mimeType: string): Promise<ExtraccionTarifario> {
  const textoJson = await extraerJsonDeDocumento({ instruccion: INSTRUCCION, archivoBase64, mimeType, esquemaJson: ESQUEMA_GEMINI });
  let bruto: unknown;
  try {
    bruto = JSON.parse(textoJson);
  } catch {
    throw new Error("La IA no devolvió un JSON válido. Intenta con una foto más clara o un PDF de texto (no escaneado borroso).");
  }
  const parsed = esquemaExtraccion.safeParse(bruto);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "No se pudo interpretar el documento.");
  return parsed.data;
}
