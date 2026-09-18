import { IVA, type LineaCalculo, type Moneda } from "./tipos";

/** Redondea a centavos. Todas las salidas del motor pasan por aquí. */
export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Precio de venta de una línea según su tipo de margen (spec §5.2).
 * No simplificar ni "mejorar": las fórmulas se verificaron contra expedientes reales.
 */
export function ventaLinea(l: LineaCalculo): number {
  const { cantidad, costo_unitario: costo, valor_margen: margen } = l;
  switch (l.tipo_margen) {
    case "porcentaje":
      return redondear(costo * cantidad * (1 + margen / 100));
    case "monto_fijo":
      return redondear((costo + margen) * cantidad);
    case "precio_fijo":
      return redondear(margen * cantidad);
  }
}

/** Lo que le cuesta a Dams Cargo la línea completa. */
export function costoLinea(l: LineaCalculo): number {
  return redondear(l.costo_unitario * l.cantidad);
}

/**
 * Venta sin IVA, para rentabilidad interna (spec §5.6).
 * Los montos en Q se presentan con IVA incluido; los de USD sin IVA.
 */
export function ventaSinIva(venta: number, l: { moneda: Moneda; lleva_iva: boolean }): number {
  if (l.moneda === "GTQ" && l.lleva_iva) return redondear(venta / (1 + IVA));
  return venta;
}
