import { describe, expect, it } from "vitest";
import { totalesCotizacion } from "../totales";
import type { LineaCalculo } from "../tipos";

type Req = Pick<LineaCalculo, "nombre" | "categoria" | "moneda" | "costo_unitario" | "tipo_margen" | "valor_margen">;
const L = (p: Partial<LineaCalculo> & Req): LineaCalculo => ({ cantidad: 1, lleva_iva: true, ...p });

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Caso de prueba de la sección 10 de la spec: Grupo Aliados Estratégicos. Mismos costos que la semilla. */
const grupoAliados: LineaCalculo[] = [
  L({ nombre: "Flete Marítimo", categoria: "internacional", moneda: "USD", costo_unitario: 5227.27, tipo_margen: "porcentaje", valor_margen: 10 }),
  L({ nombre: "BL", categoria: "internacional", moneda: "USD", costo_unitario: 75, tipo_margen: "monto_fijo", valor_margen: 25 }),
  L({ nombre: "Recolección", categoria: "internacional", moneda: "USD", costo_unitario: 652.17, tipo_margen: "porcentaje", valor_margen: 15 }),
  L({ nombre: "Gastos Locales en Origen", categoria: "internacional", moneda: "USD", costo_unitario: 1454.55, tipo_margen: "monto_fijo", valor_margen: 145.45 }),
  L({ nombre: "Flete Terrestre Puerto a Ciudad", categoria: "local", moneda: "GTQ", costo_unitario: 4347.83, tipo_margen: "porcentaje", valor_margen: 15 }),
  L({ nombre: "Trámite de Aduana", categoria: "local", moneda: "GTQ", costo_unitario: 2083.33, tipo_margen: "porcentaje", valor_margen: 20 }),
  L({ nombre: "Patrulla", categoria: "local", moneda: "GTQ", costo_unitario: 1300, tipo_margen: "monto_fijo", valor_margen: 200 }),
  L({ nombre: "Custodio", categoria: "local", moneda: "GTQ", costo_unitario: 600, tipo_margen: "monto_fijo", valor_margen: 150 }),
];

describe("totalesCotizacion — caso Grupo Aliados", () => {
  const t = totalesCotizacion(grupoAliados, 8.05);
  it("flete internacional USD 8,200.00", () => expect(t.internacional_usd).toBe(8200));
  it("gastos locales Q 9,750.00", () => expect(t.local_gtq).toBe(9750));
  it("naviera USD 0", () => expect(t.naviera_usd).toBe(0));
  it("total general en Q = 8200*8.05 + 9750", () => expect(t.total_gtq).toBe(75760));
  it("costo total en Q", () => {
    const costoUsd = 5227.27 + 75 + 652.17 + 1454.55;
    const costoGtq = 4347.83 + 2083.33 + 1300 + 600;
    expect(t.costo_total_gtq).toBe(r2(costoUsd * 8.05 + costoGtq));
  });
  it("venta sin IVA en Q: USD tal cual, GTQ / 1.12", () => {
    expect(t.venta_total_gtq).toBe(r2(8200 * 8.05 + 9750 / 1.12));
  });
  it("utilidad y margen sobre costo", () => {
    expect(t.utilidad_gtq).toBe(r2(t.venta_total_gtq - t.costo_total_gtq));
    expect(t.margen_pct).toBe(r2((t.utilidad_gtq / t.costo_total_gtq) * 100));
    expect(t.margen_pct).toBeGreaterThan(5);
    expect(t.margen_pct).toBeLessThan(15);
  });
});

describe("totalesCotizacion — bordes", () => {
  it("sin líneas todo 0", () => {
    expect(totalesCotizacion([], 8.05)).toEqual({
      internacional_usd: 0, local_gtq: 0, naviera_usd: 0, total_gtq: 0,
      costo_total_gtq: 0, venta_total_gtq: 0, utilidad_gtq: 0, margen_pct: 0, descuento_total_gtq: 0,
    });
  });
  it("naviera se suma al total en Q; depósito sin IVA no se divide", () => {
    const t = totalesCotizacion(
      [L({ nombre: "Depósito", categoria: "naviera", moneda: "USD", costo_unitario: 500, tipo_margen: "precio_fijo", valor_margen: 500, lleva_iva: false })],
      8,
    );
    expect(t.naviera_usd).toBe(500);
    expect(t.total_gtq).toBe(4000);
    expect(t.utilidad_gtq).toBe(0);
    expect(t.margen_pct).toBe(0);
  });
  it("línea local en Q sin IVA cuenta completa como venta", () => {
    const t = totalesCotizacion(
      [L({ nombre: "x", categoria: "local", moneda: "GTQ", costo_unitario: 100, tipo_margen: "porcentaje", valor_margen: 50, lleva_iva: false })],
      8,
    );
    expect(t.venta_total_gtq).toBe(150);
    expect(t.margen_pct).toBe(50);
  });
  it("costo total 0 con venta positiva: margen 0 (no Infinity)", () => {
    const t = totalesCotizacion(
      [L({ nombre: "x", categoria: "local", moneda: "GTQ", costo_unitario: 0, tipo_margen: "precio_fijo", valor_margen: 300, lleva_iva: false })],
      8,
    );
    expect(t.utilidad_gtq).toBe(300);
    expect(t.margen_pct).toBe(0);
  });
});

describe("totalesCotizacion — con descuentos", () => {
  it("10% al total baja los tres bloques y el margen", () => {
    const sin = totalesCotizacion(grupoAliados, 8.05);
    const con = totalesCotizacion(grupoAliados, 8.05, [{ ambito: "total", tipo: "porcentaje", valor: 10 }]);
    expect(con.internacional_usd).toBe(7380);
    expect(con.local_gtq).toBe(8775);
    expect(con.total_gtq).toBe(r2(sin.total_gtq * 0.9));
    expect(con.descuento_total_gtq).toBe(r2(sin.total_gtq * 0.1));
    expect(con.costo_total_gtq).toBe(sin.costo_total_gtq);
    expect(con.margen_pct).toBeLessThan(sin.margen_pct);
  });
  it("monto fijo en Q a gastos locales", () => {
    const con = totalesCotizacion(grupoAliados, 8.05, [{ ambito: "local", tipo: "monto", valor: 250 }]);
    expect(con.local_gtq).toBe(9500);
    expect(con.internacional_usd).toBe(8200);
    expect(con.descuento_total_gtq).toBe(250);
  });
});
