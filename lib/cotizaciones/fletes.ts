import { ventaLinea } from "@/lib/calculo/linea";
import type { Moneda, Recargos } from "@/lib/calculo/tipos";
import type { TarifaRuta, TipoServicio } from "@/lib/supabase/tipos";

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const palabras = (s: string) => normalizar(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
/** "40HQ" y "40HC" son el mismo contenedor: se igualan para comparar con el tipo de carga elegido. */
export const claveContenedor = (s: string) => normalizar(s).replace(/[^a-z0-9]/g, "").replace(/hq/g, "hc");

export const rutaCoincideOrigen = (r: Pick<TarifaRuta, "pais" | "origen" | "via">, palabrasOrigen: string[]) => {
  const h = normalizar(`${r.pais ?? ""} ${r.origen} ${r.via ?? ""}`);
  return palabrasOrigen.length > 0 && palabrasOrigen.every((p) => h.includes(p));
};

/**
 * Si el tipo de carga es un contenedor (FCL 20GP…), solo las tarifas de ese tamaño; sin tipo, todas.
 * Las filas viejas no tienen variante y traen el tamaño dentro de «vía» ("PIL 20GP"): se lee de ahí.
 */
export const varianteSirve = (r: Pick<TarifaRuta, "variante" | "via">, tipoCarga?: string | null) => {
  if (!tipoCarga) return true;
  if (r.variante) {
    // "40GP/HQ" es una sola columna que sirve para 40GP y para 40HQ: se prueba cada parte con el número de la primera.
    const partes = r.variante.split(/[/,]/).map((p) => p.trim()).filter(Boolean);
    const numero = partes[0]?.match(/^\d+/)?.[0] ?? "";
    const claves = partes.map((p) => claveContenedor(/^\d/.test(p) ? p : `${numero}${p}`));
    return !claves.some((v) => /^(20|40|45)/.test(v)) || claves.some((v) => claveContenedor(tipoCarga).includes(v));
  }
  const tamanos = [...(r.via ?? "").matchAll(/(?<!\d)(20|40|45)(?!\d)/g)].map((m) => m[1]);
  const pedido = tipoCarga.match(/(?<!\d)(20|40|45)(?!\d)/)?.[1];
  return !tamanos.length || !pedido || tamanos.includes(pedido);
};

export const ventaRuta = (r: TarifaRuta, moneda: Moneda, recargos: Recargos) =>
  ventaLinea({ nombre: "", categoria: "internacional", moneda, cantidad: 1, costo_unitario: Number(r.costo ?? 0), tipo_margen: r.tipo_margen, valor_margen: Number(r.valor_margen), lleva_iva: true, aplica_recargos: r.aplica_recargos }, recargos);

export interface TarifarioFlete { id: string; nombre: string; moneda: Moneda; seccion: string; servicio: TipoServicio | null }
export interface OpcionFlete<T extends TarifarioFlete = TarifarioFlete> { ruta: TarifaRuta; tarifario: T; venta: number }

/** Fletes de un origen en todos los tarifarios dados, de menor a mayor precio de venta. Los que no tienen monto no se ofrecen. */
export function buscarFletes<T extends TarifarioFlete>(opciones: {
  rutas: TarifaRuta[];
  tarifarios: T[];
  origen: string;
  tipoCarga?: string | null;
  recargos: Recargos;
  limite?: number;
}): OpcionFlete<T>[] {
  const pals = palabras(opciones.origen);
  if (!pals.length) return [];
  const porId = new Map(opciones.tarifarios.map((t) => [t.id, t]));
  return opciones.rutas
    .flatMap((r) => {
      const t = porId.get(r.tarifario_id);
      return t && rutaCoincideOrigen(r, pals) && varianteSirve(r, opciones.tipoCarga) ? [{ ruta: r, tarifario: t, venta: ventaRuta(r, t.moneda, opciones.recargos) }] : [];
    })
    .filter((x) => x.venta > 0)
    .sort((a, b) => a.venta - b.venta)
    .slice(0, opciones.limite ?? 10);
}

/** Tránsito con unidad ("32-35 days" → "32-35 días", "35" → "35 días"). */
export const textoTransito = (t: string | null) => (t ? (/[a-z]/i.test(t) ? t.replace(/days?/i, "días") : `${t} días`) : "");
export const textoVia = (via: string | null) => (via && via.toLowerCase() !== "direct" && via.toLowerCase() !== "directo" ? `Vía ${via}` : "Directo");
