import { describe, expect, it } from "vitest";
import { buscarFletes, rutaCoincideOrigen, palabras, varianteSirve } from "../fletes";
import { SIN_RECARGOS } from "@/lib/calculo/tipos";
import type { TarifaRuta } from "@/lib/supabase/tipos";

const ruta = (o: Partial<TarifaRuta>): TarifaRuta => ({ id: "r", tarifario_id: "t1", pais: null, origen: "Shanghai", destino: "Guatemala", via: null, variante: null, costo: 1000, unidad: "contenedor", minimo: null, transito: null, tipo_margen: "precio_fijo", valor_margen: 1000, aplica_recargos: false, notas: null, archivado_at: null, created_at: "", ...o }) as TarifaRuta;

describe("varianteSirve", () => {
  it("usa la variante y trata 40HQ como 40HC", () => {
    expect(varianteSirve(ruta({ variante: "20GP" }), "FCL 20GP")).toBe(true);
    expect(varianteSirve(ruta({ variante: "40HQ" }), "FCL 40HC")).toBe(true);
    expect(varianteSirve(ruta({ variante: "40GP" }), "FCL 20GP")).toBe(false);
  });
  it("en filas viejas lee el tamaño de «vía»", () => {
    expect(varianteSirve(ruta({ via: "PIL 20GP" }), "FCL 20GP")).toBe(true);
    expect(varianteSirve(ruta({ via: "PIL 40GP/HQ" }), "FCL 20GP")).toBe(false);
    expect(varianteSirve(ruta({ via: "Hong Kong" }), "FCL 20GP")).toBe(true);
  });
});

describe("buscarFletes", () => {
  const tarifarios = [{ id: "t1", nombre: "HYDE", moneda: "USD" as const, seccion: "flete_maritimo", servicio: null }];
  it("encuentra por origen aunque venga con país, ordena por precio y descarta lo vacío", () => {
    const rutas = [
      ruta({ id: "a", pais: "China", variante: "20GP", valor_margen: 2500 }),
      ruta({ id: "b", pais: "China", variante: "20GP", via: "WHL", valor_margen: 2400 }),
      ruta({ id: "c", pais: "China", variante: "40HQ", valor_margen: 3700 }),
      ruta({ id: "d", origen: "Ningbo", variante: "20GP", valor_margen: 2000 }),
      ruta({ id: "e", variante: "20GP", valor_margen: 0, costo: null }),
    ];
    const r = buscarFletes({ rutas, tarifarios, origen: "Shanghai, China", tipoCarga: "FCL 20GP", recargos: SIN_RECARGOS });
    expect(r.map((x) => x.ruta.id)).toEqual(["b", "a"]);
    expect(rutaCoincideOrigen(rutas[0], palabras("shanghai china"))).toBe(true);
  });
});
