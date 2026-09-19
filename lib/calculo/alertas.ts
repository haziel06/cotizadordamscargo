import { SOBREPESO_KG, type LineaCalculo } from "./tipos";

export type TipoAlerta = "margen_bajo" | "tipo_cambio" | "linea_cero" | "sobrepeso";
export interface Alerta {
  tipo: TipoAlerta;
  mensaje: string;
}

export const MARGEN_MINIMO_PCT = 15;
export const TIPO_CAMBIO_MIN = 7.5;
export const TIPO_CAMBIO_MAX = 8.5;

/** Alertas no bloqueantes de la spec §7.4. */
export function alertasCotizacion(p: { margen_pct: number; tipo_cambio: number; lineas: LineaCalculo[]; kilogramos?: number | null }): Alerta[] {
  const alertas: Alerta[] = [];

  if ((p.kilogramos ?? 0) > SOBREPESO_KG) {
    alertas.push({ tipo: "sobrepeso", mensaje: `Sobrepeso: la carga supera los ${SOBREPESO_KG.toLocaleString("en-US")} kg (puede llevar costo extra)` });
  }
  if (p.lineas.length > 0 && p.margen_pct < MARGEN_MINIMO_PCT) {
    alertas.push({ tipo: "margen_bajo", mensaje: "Margen bajo comparado con el histórico" });
  }
  if (p.tipo_cambio < TIPO_CAMBIO_MIN || p.tipo_cambio > TIPO_CAMBIO_MAX) {
    alertas.push({ tipo: "tipo_cambio", mensaje: "Verifica el tipo de cambio" });
  }
  for (const l of p.lineas) {
    if (l.tipo_margen === "porcentaje" && l.costo_unitario === 0) {
      alertas.push({ tipo: "linea_cero", mensaje: `"${l.nombre}" tiene costo 0 y margen en porcentaje: el precio saldrá en 0` });
    }
  }
  return alertas;
}
