import { describe, expect, it } from "vitest";
import { alertasCotizacion } from "../alertas";
import type { LineaCalculo } from "../tipos";

const linea: LineaCalculo = {
  nombre: "Seguro", categoria: "internacional", moneda: "USD", cantidad: 1,
  costo_unitario: 0, tipo_margen: "porcentaje", valor_margen: 15, lleva_iva: true,
};
const ok: LineaCalculo = { ...linea, nombre: "Flete", costo_unitario: 100 };

describe("alertasCotizacion", () => {
  it("margen bajo", () => {
    const a = alertasCotizacion({ margen_pct: 12, tipo_cambio: 8.05, lineas: [ok] });
    expect(a.map((x) => x.tipo)).toEqual(["margen_bajo"]);
  });
  it("sin alerta de margen si no hay líneas", () => {
    expect(alertasCotizacion({ margen_pct: 0, tipo_cambio: 8.05, lineas: [] })).toEqual([]);
  });
  it("tipo de cambio fuera de rango", () => {
    expect(alertasCotizacion({ margen_pct: 20, tipo_cambio: 9, lineas: [] })[0].tipo).toBe("tipo_cambio");
    expect(alertasCotizacion({ margen_pct: 20, tipo_cambio: 7.4, lineas: [] })[0].tipo).toBe("tipo_cambio");
  });
  it("línea con costo 0 y porcentaje", () => {
    const a = alertasCotizacion({ margen_pct: 20, tipo_cambio: 8, lineas: [linea] });
    expect(a[0].tipo).toBe("linea_cero");
    expect(a[0].mensaje).toContain("Seguro");
  });
  it("costo 0 con precio fijo no alerta", () => {
    const l = { ...linea, tipo_margen: "precio_fijo" as const, valor_margen: 300 };
    expect(alertasCotizacion({ margen_pct: 20, tipo_cambio: 8, lineas: [l] })).toEqual([]);
  });
});
