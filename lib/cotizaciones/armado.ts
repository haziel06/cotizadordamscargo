import type { Concepto, SegmentoCourier } from "@/lib/supabase/tipos";
import type { Unidad } from "@/lib/calculo/tipos";

export const LB_POR_KG = 2.20462;

/** Cantidad automática de una línea según la unidad de su concepto (spec §7.2-B, ampliada con libras). */
export function cantidadPorUnidad(u: Unidad, pesoCobrable: number, cbm: number): number {
  if (u === "kg") return pesoCobrable || 1;
  if (u === "libra") return pesoCobrable ? Math.round(pesoCobrable * LB_POR_KG * 100) / 100 : 1;
  if (u === "cbm") return cbm || 1;
  if (u === "pie_cubico") return cbm ? Math.round(cbm * 35.3147 * 100) / 100 : 1;
  return 1;
}

/**
 * Qué conceptos lleva una cotización courier. Consolidado = solo la libra (+ entrega). Ticket = libra +
 * trámite aduanero + entrega, y el almacenaje (Combex) como pago a tercero, aparte. Solo agrega lo que
 * falte (`yaMarcados`). Lo usan el botón "Armar courier" del editor y el asistente de chat: una sola regla.
 */
export function conceptosCourier(
  aplicables: Concepto[],
  opciones: { segmento: SegmentoCourier; pesoCobrable: number; fueraPerimetro?: boolean; yaMarcados: Set<string | null> },
): Concepto[] {
  const { segmento, yaMarcados, fueraPerimetro } = opciones;
  const libras = opciones.pesoCobrable ? opciones.pesoCobrable * LB_POR_KG : 0;
  const primero = (xs: Concepto[]) => xs.find((c) => !yaMarcados.has(c.id));
  const nuevas: Concepto[] = [];
  const courier = primero(aplicables.filter((c) => c.seccion === "courier" && c.unidad === "libra"));
  if (courier) nuevas.push(courier);
  // Entrega según el peso: hasta 132 lb va incluida (línea en $0 para que el cliente lo vea).
  const entregas = aplicables.filter((c) => c.seccion === "entrega_domicilio");
  const entrega = primero(entregas.filter((c) => (c.rango_desde == null || libras >= Number(c.rango_desde)) && (c.rango_hasta == null || libras <= Number(c.rango_hasta)))) ?? primero(entregas);
  if (entrega && !(fueraPerimetro && Number(entrega.costo) === 0 && Number(entrega.valor_margen) === 0)) nuevas.push(entrega);
  if (segmento === "ticket") {
    const docs = aplicables.filter((c) => c.seccion === "documentacion" && /tr[aá]mite/i.test(c.nombre));
    const tramite = primero(docs.filter((c) => /courier|a[eé]reo|lcl/i.test(c.nombre))) ?? primero(docs);
    if (tramite) nuevas.push(tramite);
    for (const a of aplicables.filter((c) => c.seccion === "gastos_ajenos" || c.cuenta_ajena)) if (!yaMarcados.has(a.id)) nuevas.push(a);
  }
  return nuevas;
}
