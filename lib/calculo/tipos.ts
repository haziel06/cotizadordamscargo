export type Moneda = "USD" | "GTQ";
export type Categoria = "internacional" | "local" | "naviera";
export type TipoMargen = "porcentaje" | "monto_fijo" | "precio_fijo";
export type Unidad = "envio" | "contenedor" | "kg" | "cbm" | "libra" | "pie_cubico" | "guia" | "factura";

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
  /** Si el costo es de proveedor extranjero, lleva ISR y "no domiciliada" encima (ver Recargos). */
  aplica_recargos?: boolean;
}

/**
 * Impuestos que la empresa carga sobre el costo de proveedores extranjeros antes del margen.
 * Fórmula real de la oficina: venta = costo × (1 + ISR) × (1 + no domiciliada) × (1 + margen).
 */
export interface Recargos {
  isr_pct: number;
  no_domiciliada_pct: number;
}
export const SIN_RECARGOS: Recargos = { isr_pct: 0, no_domiciliada_pct: 0 };

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
  /** Suma de descuentos aplicados, en Q. Solo interno. */
  descuento_total_gtq: number;
}
