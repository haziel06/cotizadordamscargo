import type { FilaExtraida } from "@/lib/ia/tarifarioIA";

export type EstadoCambio = "nuevo" | "cambia" | "igual";

export interface CambioFila {
  /** Identificador estable dentro de la propuesta (para la tabla de revisión). */
  clave: string;
  tipo: "ruta" | "concepto";
  estado: EstadoCambio;
  /** Fila existente que se actualiza; null si es nueva. */
  existenteId: string | null;
  fila: FilaExtraida;
  anterior: { costo: number | null; minimo: number | null } | null;
  /** Nombre con el que se guardaría (concepto con su variante) o el tramo, para mostrar. */
  etiqueta: string;
}

export interface PropuestaActualizacion {
  tarifarioId: string;
  tarifarioNombre: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  condiciones: string;
  cambios: CambioFila[];
}

export interface FilasExistentes {
  rutas: { id: string; origen: string; via: string | null; variante: string | null; costo: number | null; minimo: number | null }[];
  conceptos: { id: string; nombre: string; costo: number | null; minimo: number | null }[];
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Misma regla con la que se guardan: el concepto lleva su variante entre paréntesis. */
export const nombreConcepto = (f: Pick<FilaExtraida, "nombre" | "variante">) => `${f.nombre || "Concepto sin nombre"}${f.variante ? ` (${f.variante})` : ""}`;
/** Palabras sueltas normalizadas; 40HQ y 40HC son lo mismo, y "directo" no distingue nada. */
const tokens = (t: string | null | undefined) =>
  new Set(norm(t ?? "").split(" ").filter((x) => x && x !== "direct" && x !== "directo").map((x) => x.replace(/hq$/, "hc")));
const mismosTokens = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((t) => b.has(t));
const contiene = (grande: Set<string>, chico: Set<string>) => chico.size > 0 && [...chico].every((t) => grande.has(t));
/** Lo que distingue una fila de otra del mismo origen: naviera/vía + tamaño. Datos viejos lo traen todo junto en "vía" ("PIL 20GP"). */
const detalleRuta = (r: { via: string | null; variante: string | null }) => tokens(`${r.via ?? ""} ${r.variante ?? ""}`);
const igual = (a: number | null | undefined, b: number | null | undefined) => (a == null && b == null) || (a != null && b != null && Math.abs(Number(a) - Number(b)) < 0.005);

/**
 * Compara lo que dice el documento nuevo con el tarifario actual. Los proveedores a veces solo actualizan
 * unos precios: lo que NO aparece en el documento no se toca (no hay "borrados"). Una ruta se reconoce por
 * origen + variante; un concepto, por su nombre.
 */
export function calcularCambios(existentes: FilasExistentes, filas: FilaExtraida[]): CambioFila[] {
  return filas.map((fila, i): CambioFila => {
    const clave = `f${i}`;
    if (fila.tipo === "ruta") {
      const origenNuevo = tokens(fila.origen);
      // Origen abreviado en uno u otro lado ("nansha huangpu" vs "Nansha") cuenta como el mismo.
      const candidatas = existentes.rutas.filter((r) => { const o = tokens(r.origen); return contiene(o, origenNuevo) || contiene(origenNuevo, o); });
      const nuevo = detalleRuta(fila);
      const parciales = candidatas.filter((r) => nuevo.size > 0 && contiene(detalleRuta(r), nuevo));
      const previa =
        candidatas.find((r) => mismosTokens(detalleRuta(r), nuevo)) ??
        (parciales.length === 1 ? parciales[0] : undefined) ??
        (nuevo.size === 0 && candidatas.length === 1 ? candidatas[0] : undefined);
      const etiqueta = [fila.origen, fila.via, fila.variante].filter(Boolean).join(" · ");
      if (!previa) return { clave, tipo: "ruta", estado: "nuevo", existenteId: null, fila, anterior: null, etiqueta };
      const mismo = igual(previa.costo, fila.costo) && (fila.minimo == null || igual(previa.minimo, fila.minimo));
      return { clave, tipo: "ruta", estado: mismo ? "igual" : "cambia", existenteId: previa.id, fila, anterior: { costo: previa.costo, minimo: previa.minimo }, etiqueta };
    }
    const nombre = nombreConcepto(fila);
    const previa = existentes.conceptos.find((c) => norm(c.nombre) === norm(nombre));
    if (!previa) return { clave, tipo: "concepto", estado: "nuevo", existenteId: null, fila, anterior: null, etiqueta: nombre };
    const mismo = igual(previa.costo, fila.costo) && (fila.minimo == null || igual(previa.minimo, fila.minimo));
    return { clave, tipo: "concepto", estado: mismo ? "igual" : "cambia", existenteId: previa.id, fila, anterior: { costo: previa.costo, minimo: previa.minimo }, etiqueta: nombre };
  });
}

export const resumenCambios = (cambios: CambioFila[]) => ({
  nuevos: cambios.filter((c) => c.estado === "nuevo").length,
  cambian: cambios.filter((c) => c.estado === "cambia").length,
  iguales: cambios.filter((c) => c.estado === "igual").length,
});
