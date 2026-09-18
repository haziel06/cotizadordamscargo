export type Moneda = "USD" | "GTQ";
export type Categoria = "internacional" | "local" | "naviera";
export type TipoMargen = "porcentaje" | "monto_fijo" | "precio_fijo";
export type Unidad = "envio" | "contenedor" | "kg" | "cbm" | "libra";

/** IVA de Guatemala. */
export const IVA = 0.12;

export interface LineaCalculo {
  nombre: string;
  categoria: Categoria;
  moneda: Moneda;
  cantidad: number;
  costo_unitario: number;
  tipo_margen: TipoMargen;
  valor_margen: number;
  lleva_iva: boolean;
}

export interface Totales {
  /** Suma de ventas del bloque flete internacional, en USD (sin IVA). */
  internacional_usd: number;
  /** Suma de ventas del bloque gastos locales, en Q (con IVA incluido). */
  local_gtq: number;
  /** Suma de ventas del bloque gastos de naviera, en USD (sin IVA). */
  naviera_usd: number;
  /** Total general que ve el cliente, en Q. */
  total_gtq: number;
  /** Solo interno: nunca va al PDF. */
  costo_total_gtq: number;
  venta_total_gtq: number;
  utilidad_gtq: number;
  margen_pct: number;
}
