import { costoLinea, redondear, ventaSinIva } from "./linea";
import { aplicarDescuentos, type Descuento } from "./descuentos";
import { SIN_RECARGOS, type LineaCalculo, type Recargos, type Totales } from "./tipos";

/** Convierte a Q un monto según la moneda de la línea (spec §5.5). */
const aQuetzales = (monto: number, moneda: LineaCalculo["moneda"], tipoCambio: number) =>
  moneda === "USD" ? monto * tipoCambio : monto;
const aDolares = (monto: number, moneda: LineaCalculo["moneda"], tipoCambio: number) =>
  moneda === "GTQ" ? (tipoCambio > 0 ? monto / tipoCambio : 0) : monto;

/**
 * Totales por bloque (lo que ve el cliente) y rentabilidad interna (spec §5.6).
 * Única fuente de números: formulario, guardado y PDF consumen esto.
 * Los descuentos ya vienen repartidos en las ventas por línea (ver descuentos.ts).
 */
export function totalesCotizacion(lineas: LineaCalculo[], tipoCambio: number, descuentos: Descuento[] = [], recargos: Recargos = SIN_RECARGOS): Totales {
  const { ventas, descuento_total_gtq } = aplicarDescuentos(lineas, descuentos, tipoCambio, recargos);

  let internacional_usd = 0;
  let local_gtq = 0;
  let naviera_usd = 0;
  let costoQ = 0;
  let ventaQ = 0;
  let ajenos_usd = 0;
  let ajenos_gtq = 0;

  lineas.forEach((l, i) => {
    const venta = ventas[i];
    if (l.cuenta_ajena) {
      if (l.moneda === "USD") ajenos_usd += venta;
      else ajenos_gtq += venta;
      return;
    }
    // Una línea puede estar en otra moneda que su bloque (ej. entrega a domicilio en USD dentro de
    // gastos locales): se convierte a la moneda del bloque.
    switch (l.categoria) {
      case "internacional":
        internacional_usd += aDolares(venta, l.moneda, tipoCambio);
        break;
      case "local":
        local_gtq += aQuetzales(venta, l.moneda, tipoCambio);
        break;
      case "naviera":
        naviera_usd += aDolares(venta, l.moneda, tipoCambio);
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
    ajenos_usd: redondear(ajenos_usd), ajenos_gtq: redondear(ajenos_gtq),
  };
}

/** Venta final por línea (con descuentos repartidos), para congelar en la base y mostrar en el PDF. */
export function ventasFinales(lineas: LineaCalculo[], tipoCambio: number, descuentos: Descuento[] = [], recargos: Recargos = SIN_RECARGOS): number[] {
  return aplicarDescuentos(lineas, descuentos, tipoCambio, recargos).ventas;
}
