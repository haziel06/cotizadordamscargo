import { IVA, SIN_RECARGOS, type LineaCalculo, type Moneda, type Recargos } from "./tipos";

/** Redondea a centavos. Todas las salidas del motor pasan por aquí. */
export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Costo de proveedor extranjero con ISR y "no domiciliada" encima. Sin redondear: es un paso intermedio. */
export function costoConRecargos(costo: number, r: Recargos): number {
  return costo * (1 + r.isr_pct / 100) * (1 + r.no_domiciliada_pct / 100);
}

/** Costo base sobre el que se aplica el margen: con recargos si la línea los lleva. */
export function costoBase(l: LineaCalculo, r: Recargos = SIN_RECARGOS): number {
  return l.aplica_recargos ? costoConRecargos(l.costo_unitario, r) : l.costo_unitario;
}

/**
 * Costo total de la línea antes del margen (con recargos si aplica), respetando el mínimo
 * facturable del proveedor: si cantidad × costo no lo alcanza, se cobra el mínimo.
 * El mínimo viene en costo crudo del proveedor; los recargos se le aplican igual que al resto.
 */
function costoTotalConMinimo(l: LineaCalculo, r: Recargos): number {
  const crudo = l.costo_unitario * l.cantidad;
  const efectivo = l.minimo != null && crudo < l.minimo ? l.minimo : crudo;
  return l.aplica_recargos ? costoConRecargos(efectivo, r) : efectivo;
}

/**
 * Precio de venta de una línea según su tipo de margen (spec §5.2, ampliada con la fórmula
 * real de la oficina: los impuestos van sobre el costo y el margen encima).
 *   porcentaje:  base × cantidad × (1 + %), o el mínimo del proveedor si no se alcanza
 *   monto_fijo:  (base + fijo) × cantidad      ← el fijo se gana limpio (caso FCL)
 *   precio_fijo: fijo × cantidad               ← ignora costo y recargos
 */
export function ventaLinea(l: LineaCalculo, r: Recargos = SIN_RECARGOS): number {
  const { cantidad, valor_margen: margen } = l;
  switch (l.tipo_margen) {
    case "porcentaje":
      return redondear(costoTotalConMinimo(l, r) * (1 + margen / 100));
    case "monto_fijo":
      return redondear((costoBase(l, r) + margen) * cantidad);
    case "precio_fijo": {
      const bruto = margen * cantidad;
      return redondear(l.minimo != null && bruto < l.minimo ? l.minimo : bruto);
    }
  }
}

/**
 * Precio de lista por 1 unidad, ignorando el mínimo del proveedor (que es un piso sobre el
 * total, no el precio real por unidad). Para mostrar "$X.XX/lb" en los controles, no para totales.
 */
export function ventaUnitariaLista(l: LineaCalculo, r: Recargos = SIN_RECARGOS): number {
  const { valor_margen: margen } = l;
  const base = costoBase(l, r);
  switch (l.tipo_margen) {
    case "porcentaje":
      return redondear(base * (1 + margen / 100));
    case "monto_fijo":
      return redondear(base + margen);
    case "precio_fijo":
      return redondear(margen);
  }
}

/** Lo que le cuesta a Dams Cargo la línea completa (sin recargos: eso es impuesto, no costo del proveedor). */
export function costoLinea(l: LineaCalculo): number {
  return redondear(l.costo_unitario * l.cantidad);
}

/**
 * Inversa para el control enlazado costo · margen · venta: dado un precio de venta unitario,
 * ¿qué % y qué monto se está ganando sobre el costo (con recargos)?
 */
export function margenDesdeVenta(l: LineaCalculo, ventaUnitaria: number, r: Recargos = SIN_RECARGOS): { pct: number; monto: number } {
  const base = costoBase(l, r);
  const monto = redondear(ventaUnitaria - base);
  const pct = base > 0 ? redondear(((ventaUnitaria - base) / base) * 100) : 0;
  return { pct, monto };
}

/**
 * Venta sin IVA, para rentabilidad interna (spec §5.6).
 * Los montos en Q se presentan con IVA incluido; los de USD sin IVA.
 */
export function ventaSinIva(venta: number, l: { moneda: Moneda; lleva_iva: boolean }): number {
  if (l.moneda === "GTQ" && l.lleva_iva) return redondear(venta / (1 + IVA));
  return venta;
}
