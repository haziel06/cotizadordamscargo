import { describe, expect, it } from "vitest";
import { costoConRecargos, margenDesdeVenta, ventaLinea } from "../linea";
import type { LineaCalculo } from "../tipos";

const RECARGOS = { isr_pct: 7, no_domiciliada_pct: 5.263 };

const base: LineaCalculo = {
  nombre: "x", categoria: "internacional", moneda: "USD", cantidad: 1,
  costo_unitario: 1.35, tipo_margen: "porcentaje", valor_margen: 40, lleva_iva: true, aplica_recargos: true,
};

describe("costoConRecargos", () => {
  it("aplica ISR y no domiciliada sobre el costo", () => {
    expect(costoConRecargos(1478.68, RECARGOS)).toBeCloseTo(1665.46, 2);
  });
  it("sin recargos devuelve el costo", () => {
    expect(costoConRecargos(100, { isr_pct: 0, no_domiciliada_pct: 0 })).toBe(100);
  });
});

describe("ventaLinea con recargos (fórmula real de la oficina)", () => {
  it("aéreo priority: 1.35 × 1.07 × 1.05263 × 1.40 ≈ 2.13", () => {
    expect(ventaLinea(base, RECARGOS)).toBe(2.13);
  });
  it("courier al 45%: 2.30 → 3.75", () => {
    expect(ventaLinea({ ...base, costo_unitario: 2.3, valor_margen: 45 }, RECARGOS)).toBe(3.76);
  });
  it("monto fijo: impuestos sobre el costo, el fijo se suma limpio", () => {
    expect(ventaLinea({ ...base, costo_unitario: 1000, tipo_margen: "monto_fijo", valor_margen: 200 }, RECARGOS)).toBe(1326.31);
  });
  it("precio fijo ignora costo y recargos", () => {
    expect(ventaLinea({ ...base, tipo_margen: "precio_fijo", valor_margen: 750 }, RECARGOS)).toBe(750);
  });
  it("aplica_recargos=false: fórmula simple", () => {
    expect(ventaLinea({ ...base, aplica_recargos: false, costo_unitario: 100, valor_margen: 20 }, RECARGOS)).toBe(120);
  });
  it("sin pasar recargos se comporta como antes (compatibilidad)", () => {
    expect(ventaLinea({ ...base, costo_unitario: 100, valor_margen: 20 })).toBe(120);
  });
  it("multiplica por cantidad", () => {
    expect(ventaLinea({ ...base, cantidad: 130 }, RECARGOS)).toBe(276.74);
  });
});

describe("margenDesdeVenta (para el control enlazado costo · margen · venta)", () => {
  it("dado el precio de venta, devuelve el % de margen sobre el costo con recargos", () => {
    const m = margenDesdeVenta({ ...base, costo_unitario: 2.3 }, 3.75, RECARGOS);
    expect(m.pct).toBeCloseTo(44.8, 1);
    expect(m.monto).toBeCloseTo(1.16, 2);
  });
  it("costo 0 → margen 0 y monto = venta", () => {
    const m = margenDesdeVenta({ ...base, costo_unitario: 0 }, 50, RECARGOS);
    expect(m.pct).toBe(0);
    expect(m.monto).toBe(50);
  });
});
