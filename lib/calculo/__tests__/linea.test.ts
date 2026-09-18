import { describe, expect, it } from "vitest";
import { costoLinea, ventaLinea, ventaSinIva } from "../linea";
import type { LineaCalculo } from "../tipos";

const base: LineaCalculo = {
  nombre: "x",
  categoria: "local",
  moneda: "GTQ",
  cantidad: 1,
  costo_unitario: 100,
  tipo_margen: "porcentaje",
  valor_margen: 20,
  lleva_iva: true,
};

describe("ventaLinea", () => {
  it("porcentaje: costo * cantidad * (1 + %/100)", () => {
    expect(ventaLinea({ ...base, cantidad: 2 })).toBe(240);
  });
  it("monto_fijo: (costo + fijo) * cantidad", () => {
    expect(ventaLinea({ ...base, tipo_margen: "monto_fijo", valor_margen: 50, cantidad: 3 })).toBe(450);
  });
  it("precio_fijo: fijo * cantidad, ignora costo", () => {
    expect(ventaLinea({ ...base, tipo_margen: "precio_fijo", valor_margen: 600, costo_unitario: 999 })).toBe(600);
  });
  it("redondea a 2 decimales", () => {
    expect(ventaLinea({ ...base, costo_unitario: 5227.27, valor_margen: 10 })).toBe(5750);
    expect(ventaLinea({ ...base, costo_unitario: 652.17, valor_margen: 15 })).toBe(750);
  });
  it("costo 0 con porcentaje da 0", () => {
    expect(ventaLinea({ ...base, costo_unitario: 0 })).toBe(0);
  });
});

describe("costoLinea", () => {
  it("costo * cantidad", () => {
    expect(costoLinea({ ...base, costo_unitario: 0.55, cantidad: 1000 })).toBe(550);
  });
});

describe("ventaSinIva", () => {
  it("GTQ con IVA: divide entre 1.12", () => {
    expect(ventaSinIva(112, { moneda: "GTQ", lleva_iva: true })).toBe(100);
  });
  it("GTQ sin IVA: igual", () => {
    expect(ventaSinIva(500, { moneda: "GTQ", lleva_iva: false })).toBe(500);
  });
  it("USD: siempre igual (se presenta sin IVA)", () => {
    expect(ventaSinIva(500, { moneda: "USD", lleva_iva: true })).toBe(500);
  });
});
