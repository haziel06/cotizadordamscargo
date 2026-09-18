import { costoLinea, redondear, ventaSinIva } from "./linea";
import { aplicarDescuentos, type Descuento } from "./descuentos";
import type { LineaCalculo, Totales } from "./tipos";

/** Convierte a Q un monto según la moneda de la línea (spec §5.5). */
const aQuetzales = (monto: number, moneda: LineaCalculo["moneda"], tipoCambio: number) =>
  moneda === "USD" ? monto * tipoCambio : monto;

/**
 * Totales por bloque (lo que ve el cliente) y rentabilidad interna (spec §5.6).
 * Única fuente de números: formulario, guardado y PDF consumen esto.
 * Los descuentos ya vienen repartidos en las ventas por línea (ver descuentos.ts).
 */
export function totalesCotizacion(lineas: LineaCalculo[], tipoCambio: number, descuentos: Descuento[] = []): Totales {
  const { ventas, descuento_total_gtq } = aplicarDescuentos(lineas, descuentos, tipoCambio);

  let internacional_usd = 0;
  let local_gtq = 0;
  let naviera_usd = 0;
  let costoQ = 0;
  let ventaQ = 0;

  lineas.forEach((l, i) => {
    const venta = ventas[i];
    switch (l.categoria) {
      case "internacional":
        internacional_usd += venta;
        break;
      case "local":
        local_gtq += venta;
        break;
      case "naviera":
        naviera_usd += venta;
        break;
    }
    costoQ += aQuetzales(costoLinea(l), l.moneda, tipoCambio);
    ventaQ += aQuetzales(ventaSinIva(venta, l), l.moneda, tipoCambio);
  });

  internacional_usd = redondear(internacional_usd);
  local_gtq = redondear(local_gtq);
  naviera_usd = redondear(naviera_usd);

  const total_gtq = redondear((internacional_usd + naviera_usd) * tipoCambio + local_gtq);
  const costo_total_gtq = redondear(costoQ);
  const venta_total_gtq = redondear(ventaQ);
  const utilidad_gtq = redondear(venta_total_gtq - costo_total_gtq);
  // Margen sobre costo, no sobre venta. Así lo calcula la empresa.
  const margen_pct = costo_total_gtq > 0 ? redondear((utilidad_gtq / costo_total_gtq) * 100) : 0;

  return {
    internacional_usd, local_gtq, naviera_usd, total_gtq,
    costo_total_gtq, venta_total_gtq, utilidad_gtq, margen_pct,
    descuento_total_gtq,
  };
}

/** Venta final por línea (con descuentos repartidos), para congelar en la base y mostrar en el PDF. */
export function ventasFinales(lineas: LineaCalculo[], tipoCambio: number, descuentos: Descuento[] = []): number[] {
  return aplicarDescuentos(lineas, descuentos, tipoCambio).ventas;
}
