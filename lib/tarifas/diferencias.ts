import type { FilaExtraida } from "@/lib/ia/tarifarioIA";
import type { Moneda, Recargos, TipoMargen } from "@/lib/calculo/tipos";

export type EstadoCambio = "nuevo" | "cambia" | "igual";

export interface CambioFila {
  /** Identificador estable dentro de la propuesta (para la tabla de revisión). */
  clave: string;
  tipo: "ruta" | "concepto";
  estado: EstadoCambio;
  /** Fila existente que se actualiza; null si es nueva. */
  existenteId: string | null;
  fila: FilaExtraida;
  anterior: { costo: number | null; minimo: number | null; tipo_margen?: TipoMargen; valor_margen?: number; aplica_recargos?: boolean } | null;
  /** Nombre con el que se guardaría (concepto con su variante) o el tramo, para mostrar. */
  etiqueta: string;
}

export interface PropuestaActualizacion {
  tarifarioId: string;
  tarifarioNombre: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  condiciones: string;
  /** Para calcular en pantalla el precio de venta (compra con impuestos + margen). */
  moneda: Moneda;
  recargos: Recargos;
  cambios: CambioFila[];
}

export interface FilasExistentes {
  rutas: { id: string; origen: string; via: string | null; variante: string | null; naviera?: string | null; costo: number | null; minimo: number | null; tipo_margen?: TipoMargen; valor_margen?: number; aplica_recargos?: boolean }[];
  conceptos: { id: string; nombre: string; costo: number | null; minimo: number | null; tipo_margen?: TipoMargen; valor_margen?: number; aplica_recargos?: boolean }[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Misma regla con la que se guardan: el concepto lleva su variante entre paréntesis. */
export const nombreConcepto = (f: Pick<FilaExtraida, "nombre" | "variante">) => `${f.nombre || "Concepto sin nombre"}${f.variante ? ` (${f.variante})` : ""}`;

const igual = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);
const palabras = (t: string | null | undefined) => norm(t ?? "").split(" ").filter(Boolean);
const mismoConjunto = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((t) => b.has(t));
const contiene = (grande: Set<string>, chico: Set<string>) => chico.size > 0 && [...chico].every((t) => grande.has(t));

/**
 * Qué identifica una ruta además de su origen: la naviera, el tamaño del contenedor (20 / 40 / 45) y si es la columna NOR.
 * Las filas viejas traen todo junto en «vía» ("PIL 20GP", "WHL 40GP/HQ"); las nuevas lo traen separado. El tamaño solo
 * se compara por su número porque en estas hojas "40GP/HQ" es una sola columna (un documento recortado puede decir "40HQ").
 */
function huella(r: { via?: string | null; variante?: string | null; naviera?: string | null }) {
  const texto = palabras(`${r.naviera ?? ""} ${r.via ?? ""} ${r.variante ?? ""}`);
  const esContenedor = (w: string) => /^(\d+)?(gp|hc|hq|ft)$/.test(w) || /^\d+(gp|hc|hq|ft)$/.test(w) || /^(20|40|45)$/.test(w) || w === "nor";
  const tamano = texto.join(" ").match(/(?<!\d)(20|40|45)(?!\d)/)?.[1] ?? "";
  return { navieras: new Set(texto.filter((w) => !esContenedor(w) && w !== "direct" && w !== "directo")), tamano, nor: texto.includes("nor") };
}

/**
 * Compara lo que dice el documento nuevo con el tarifario actual. Los proveedores a veces solo actualizan
 * unos precios: lo que NO aparece en el documento no se toca (no hay "borrados"). Una ruta se reconoce por
 * origen + naviera + tamaño; un concepto, por su nombre.
 */
export function calcularCambios(existentes: FilasExistentes, filas: FilaExtraida[]): CambioFila[] {
  return filas.map((fila, i): CambioFila => {
    const clave = `f${i}`;
    if (fila.tipo === "ruta") {
      const origenNuevo = new Set(palabras(fila.origen));
      // Origen abreviado en uno u otro lado ("nansha huangpu" vs "Nansha") cuenta como el mismo.
      const candidatas = existentes.rutas.filter((r) => { const o = new Set(palabras(r.origen)); return contiene(o, origenNuevo) || contiene(origenNuevo, o); });
      const nueva = huella(fila);
      const mismas = candidatas.filter((r) => { const h = huella(r); return h.tamano === nueva.tamano && h.nor === nueva.nor; });
      // Con naviera en ambos lados debe coincidir; si el documento no la trae, vale solo si hay una única candidata.
      const previa = nueva.navieras.size > 0
        ? mismas.find((r) => mismoConjunto(huella(r).navieras, nueva.navieras))
        : mismas.length === 1 ? mismas[0] : undefined;
      const etiqueta = [fila.origen, fila.naviera || fila.via, fila.variante].filter(Boolean).join(" · ");
      if (!previa) return { clave, tipo: "ruta", estado: "nuevo", existenteId: null, fila, anterior: null, etiqueta };
      const mismo = igual(previa.costo, fila.costo) && (fila.minimo == null || igual(previa.minimo, fila.minimo));
      return { clave, tipo: "ruta", estado: mismo ? "igual" : "cambia", existenteId: previa.id, fila, anterior: { costo: previa.costo, minimo: previa.minimo, tipo_margen: previa.tipo_margen, valor_margen: previa.valor_margen, aplica_recargos: previa.aplica_recargos }, etiqueta };
    }
    const nombre = nombreConcepto(fila);
    const previa = existentes.conceptos.find((c) => norm(c.nombre) === norm(nombre));
    if (!previa) return { clave, tipo: "concepto", estado: "nuevo", existenteId: null, fila, anterior: null, etiqueta: nombre };
    const mismo = igual(previa.costo, fila.costo) && (fila.minimo == null || igual(previa.minimo, fila.minimo));
    return { clave, tipo: "concepto", estado: mismo ? "igual" : "cambia", existenteId: previa.id, fila, anterior: { costo: previa.costo, minimo: previa.minimo, tipo_margen: previa.tipo_margen, valor_margen: previa.valor_margen, aplica_recargos: previa.aplica_recargos }, etiqueta: nombre };
  });
}

export const resumenCambios = (cambios: CambioFila[]) => ({
  nuevos: cambios.filter((c) => c.estado === "nuevo").length,
  cambian: cambios.filter((c) => c.estado === "cambia").length,
  iguales: cambios.filter((c) => c.estado === "igual").length,
});
