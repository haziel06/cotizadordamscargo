import { z } from "zod";
import { hoyIso } from "@/lib/calculo/formato";
import { extraerJsonDeDocumento } from "./proveedores/gemini";

/** Esquema que le pedimos a Gemini (formato Structured Output: mayúsculas tipo OpenAPI). */
const ESQUEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    proveedor_sugerido: { type: "STRING", description: "Nombre de la empresa que EMITE esta hoja de tarifas, copiado tal cual aparece en el logo, membrete, encabezado, pie de página o firma (no la traduzcas ni la 'corrijas')" },
    nombres_empresa_vistos: { type: "ARRAY", items: { type: "STRING" }, description: "Todos los nombres de empresa distintos que aparecen escritos en el documento (emisora, sucursales, líneas navieras), tal cual" },
    nombre_tarifario: { type: "STRING", description: "Título del documento si lo tiene (ej. 'Tarifas FCL Asia - Octubre 2026')" },
    condiciones_generales: { type: "STRING", description: "Condiciones, recargos no incluidos, restricciones o aclaraciones generales que aparecen en el documento, resumidas en pocas líneas" },
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
          pais: { type: "STRING", description: "País del origen si el documento lo indica o es evidente (ej. China para Xiamen)" },
          origen: { type: "STRING" },
          destino: { type: "STRING" },
          variante: { type: "STRING", description: "Qué precio de la fila es, cuando un mismo tramo/cargo tiene varias columnas: tamaño de contenedor ('20GP', '40HQ'), escala de peso ('45-100 kg', '+1000 kg'), tipo de carga, etc." },
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
  pais: z.string().trim().optional().default(""),
  variante: z.string().trim().optional().default(""),
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
  nombres_empresa_vistos: z.array(z.string().trim()).optional().default([]),
  nombre_tarifario: z.string().trim().optional().default(""),
  condiciones_generales: z.string().trim().optional().default(""),
  servicio_sugerido: z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"]).nullable().optional().default(null),
  moneda_sugerida: z.enum(["USD", "GTQ"]).optional().default("USD"),
  vigencia_desde: fechaIso,
  vigencia_hasta: fechaIso,
  filas: z.array(esquemaFila).min(1, "No se encontraron tarifas legibles en el documento."),
});

export type FilaExtraida = z.infer<typeof esquemaFila>;
export type ExtraccionTarifario = z.infer<typeof esquemaExtraccion>;

const instruccion = (hoy: string) => [
  "Eres un asistente que lee hojas de tarifas de proveedores de logística (navieras, agentes de carga, couriers, transportistas) para una agencia en Guatemala. Los documentos pueden venir en cualquier formato: tablas, Excel impreso, correos, fotos torcidas, inglés, español o chino, una o varias páginas.",
  `Hoy es ${hoy}; úsalo solo para completar años que falten en las fechas del documento.`,
  "EMPRESA: 'proveedor_sugerido' es la empresa que emite la hoja. Búscala en el logo, membrete, encabezado, pie, sello, firma de correo o dominio del correo. Cópiala exactamente como está escrita (ej. 'CHARTER LINK', 'HYDE'), sin traducir, sin agregarle palabras y sin inventar. Lista en 'nombres_empresa_vistos' todos los nombres de empresa que veas escritos, incluidas las líneas navieras citadas.",
  "VIGENCIA: busca cualquier frase de validez ('válido hasta', 'valid until', 'rates valid', 'effective', 'vigente del…al…', 'sujeto a cambio después de', 'expires'). Conviértela a 'vigencia_desde' y 'vigencia_hasta' (AAAA-MM-DD). Si solo dice un mes ('Octubre 2026') usa el primer y último día de ese mes. Si dice 'válido hasta fin de mes', usa el último día del mes. Si no hay ninguna fecha, déjalas vacías: nunca las inventes.",
  "FILAS: extrae CADA tarifa que veas, sin resumir ni saltarte ninguna, aunque sean cientos. Una fila por tramo o cargo.",
  "Usa tipo 'ruta' para tramos con origen y destino (fletes marítimos, aéreos, terrestres). Usa tipo 'concepto' para cargos con nombre propio que no dependen de una ruta (documentación, manejo, BL, THC, seguro, almacenaje, etc.).",
  "Si un mismo tramo o cargo tiene VARIAS columnas de precio (20GP/40GP/40HQ, escalas de peso como 45 kg / 100 kg / 500 kg, tipos de carga), crea una fila por cada precio y pon en 'variante' el nombre exacto de la columna.",
  "'costo' es el número tal como aparece, SIN agregar margen ni impuestos: solo transcribe. Si una celda dice 'consultar', 'TBC' o está vacía, no crees esa fila. Usa el punto como decimal y sin separador de miles.",
  "'unidad': el contenedor para precios por contenedor, 'kg' para por kilo, 'cbm' para por metro cúbico, 'libra', 'envio' para cargos por embarque, 'guia' o 'factura' si se cobra por guía/factura. 'minimo' es el cobro mínimo si lo menciona (ej. 'min $45', 'mínimo 80 lb'). 'transito' son los días de tránsito si aparecen.",
  "'moneda_sugerida' es la moneda en que están los precios. 'condiciones_generales' resume en pocas líneas los recargos no incluidos, restricciones y avisos del documento.",
  "Si un dato no aparece en el documento, deja el campo vacío: nunca inventes cifras, nombres ni fechas.",
  "Responde SOLO con el JSON pedido.",
].join(" ");

const PALABRAS_GENERICAS = new Set([
  "logistics", "logistica", "cargo", "courier", "freight", "shipping", "lines", "line", "group",
  "corp", "corporation", "company", "express", "internacional", "international", "guatemala",
]);

const normalizar = (nombre: string) => nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function palabrasClave(nombre: string): string[] {
  return normalizar(nombre).split(" ").filter((w) => w.length >= 4 && !PALABRAS_GENERICAS.has(w));
}

/** Prueba cada nombre de empresa visto en el documento (el emisor primero) hasta dar con un proveedor ya registrado. */
export function coincideAlgunProveedor<T extends { nombre: string }>(nombres: string[], proveedores: T[]): T | undefined {
  for (const n of nombres) {
    const p = coincideProveedor(n, proveedores);
    if (p) return p;
  }
  return undefined;
}

/**
 * Empareja el proveedor sugerido por la IA con uno ya registrado por palabras clave en común,
 * ignorando términos genéricos ("logistics", "cargo"...): "Charter Link" sí calza con
 * "Charter League Logistics" (comparten "charter"), aunque el nombre completo no sea igual.
 */
export function coincideProveedor<T extends { nombre: string }>(sugerido: string, proveedores: T[]): T | undefined {
  const completo = normalizar(sugerido);
  if (!completo) return undefined;
  // Primero lo evidente: mismo nombre, o el nombre corto como palabra completa dentro del registrado ("PCS" en "PCS Logistics").
  const exacto = proveedores.find((p) => normalizar(p.nombre) === completo)
    ?? (completo.length >= 3 ? proveedores.find((p) => ` ${normalizar(p.nombre)} `.includes(` ${completo} `)) : undefined);
  if (exacto) return exacto;
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
  let textoJson: string;
  try {
    textoJson = await extraerJsonDeDocumento({ instruccion: instruccion(hoyIso()), archivoBase64, mimeType, esquemaJson: ESQUEMA_GEMINI, maxTokens: 32768 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("se cortó")) {
      throw new Error("El documento tiene tantas tarifas que no cabe en una sola lectura. Súbelo por partes (una página o sección a la vez) y usa «Agregar otra página» para sumarlas.");
    }
    throw e;
  }
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
