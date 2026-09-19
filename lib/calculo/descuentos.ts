import { redondear, ventaLinea } from "./linea";
import { SIN_RECARGOS, type Categoria, type LineaCalculo, type Moneda, type Recargos } from "./tipos";

/**
 * Descuento para clientes especiales. Puede ir sobre un bloque (en la moneda de ese bloque)
 * o sobre el total final. El cliente no ve una línea de descuento: ve los precios ya rebajados.
 */
export interface Descuento {
  ambito: Categoria | "total";
  tipo: "porcentaje" | "monto";
  valor: number;
  /** Solo para ámbito "total" con tipo "monto". Si falta, se asume GTQ. */
  moneda?: Moneda;
}

export interface ResultadoDescuentos {
  /** Venta final de cada línea, en el mismo orden de entrada, ya con descuentos repartidos. */
  ventas: number[];
  /** Descuento aplicado a cada bloque, en la moneda del bloque. */
  descuento_por_bloque: Record<Categoria, number>;
  /** Suma de todos los descuentos convertida a Q. */
  descuento_total_gtq: number;
}

const MONEDA_BLOQUE: Record<Categoria, Moneda> = { internacional: "USD", local: "GTQ", naviera: "USD" };
const BLOQUES: Categoria[] = ["internacional", "local", "naviera"];

const aQ = (monto: number, moneda: Moneda, tc: number) => (moneda === "USD" ? monto * tc : monto);

/** Resta `monto` del bloque repartiéndolo proporcionalmente entre sus líneas; la última absorbe el redondeo. */
function repartir(ventas: number[], indices: number[], monto: number) {
  const subtotal = indices.reduce((s, i) => s + ventas[i], 0);
  if (subtotal <= 0 || monto <= 0) return 0;
  const real = Math.min(monto, subtotal);
  let acumulado = 0;
  indices.forEach((i, k) => {
    const parte = k === indices.length - 1 ? redondear(real - acumulado) : redondear((ventas[i] / subtotal) * real);
    acumulado = redondear(acumulado + parte);
    ventas[i] = redondear(ventas[i] - parte);
  });
  return redondear(real);
}

export function aplicarDescuentos(lineas: LineaCalculo[], descuentos: Descuento[], tipoCambio: number, recargos: Recargos = SIN_RECARGOS): ResultadoDescuentos {
  const ventas = lineas.map((l) => ventaLinea(l, recargos));
  // Los pagos a terceros (cuenta ajena) no reciben descuento.
  const indicesPor = (c: Categoria) => lineas.map((l, i) => (l.categoria === c && !l.cuenta_ajena ? i : -1)).filter((i) => i >= 0);
  const subtotal = (c: Categoria) => indicesPor(c).reduce((s, i) => s + ventas[i], 0);
  const descuento_por_bloque: Record<Categoria, number> = { internacional: 0, local: 0, naviera: 0 };

  // Primero los descuentos por bloque, luego los del total (sobre lo que ya quedó).
  const porBloque = descuentos.filter((d) => d.ambito !== "total");
  const alTotal = descuentos.filter((d) => d.ambito === "total");

  for (const d of porBloque) {
    const c = d.ambito as Categoria;
    const base = subtotal(c);
    const monto = d.tipo === "porcentaje" ? (base * d.valor) / 100 : d.valor;
    descuento_por_bloque[c] = redondear(descuento_por_bloque[c] + repartir(ventas, indicesPor(c), monto));
  }

  for (const d of alTotal) {
    const totalQ = BLOQUES.reduce((s, c) => s + aQ(subtotal(c), MONEDA_BLOQUE[c], tipoCambio), 0);
    if (totalQ <= 0) continue;
    const montoQ = d.tipo === "porcentaje" ? (totalQ * d.valor) / 100 : aQ(d.valor, d.moneda ?? "GTQ", tipoCambio);
    const real = Math.min(montoQ, totalQ);
    for (const c of BLOQUES) {
      const pesoQ = aQ(subtotal(c), MONEDA_BLOQUE[c], tipoCambio);
      if (pesoQ <= 0) continue;
      const parteQ = (pesoQ / totalQ) * real;
      const parteBloque = MONEDA_BLOQUE[c] === "USD" ? parteQ / tipoCambio : parteQ;
      descuento_por_bloque[c] = redondear(descuento_por_bloque[c] + repartir(ventas, indicesPor(c), parteBloque));
    }
  }

  const descuento_total_gtq = redondear(
    BLOQUES.reduce((s, c) => s + aQ(descuento_por_bloque[c], MONEDA_BLOQUE[c], tipoCambio), 0),
  );
  return { ventas, descuento_por_bloque, descuento_total_gtq };
}
