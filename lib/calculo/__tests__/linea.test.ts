import { describe, expect, it } from "vitest";
import { costoLinea, ventaLinea, ventaSinIva, ventaUnitariaLista } from "../linea";
import type { LineaCalculo, Recargos } from "../tipos";

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

describe("mínimo facturable del proveedor", () => {
  const recargos: Recargos = { isr_pct: 7, no_domiciliada_pct: 5.263 };
  const expreso: LineaCalculo = {
    nombre: "Carga express aérea", categoria: "internacional", moneda: "USD", cantidad: 20,
    costo_unitario: 2.15, tipo_margen: "porcentaje", valor_margen: 45, lleva_iva: false,
    aplica_recargos: true, minimo: 172,
  };
  it("por debajo del mínimo, cobra como si fuera el mínimo", () => {
    // 20 lb * 2.15 = 43, muy por debajo de 172: se cobra sobre 172 con recargos y margen.
    const esperado = Math.round(172 * 1.07 * 1.05263 * 1.45 * 100) / 100;
    expect(ventaLinea(expreso, recargos)).toBe(esperado);
  });
  it("por encima del mínimo, cobra normal (el mínimo no estorba)", () => {
    const l = { ...expreso, cantidad: 200 }; // 200*2.15=430 > 172
    const esperado = Math.round(430 * 1.07 * 1.05263 * 1.45 * 100) / 100;
    expect(ventaLinea(l, recargos)).toBe(esperado);
  });
  it("sin mínimo definido, no cambia nada", () => {
    const l = { ...expreso, minimo: null };
    const esperado = Math.round(43 * 1.07 * 1.05263 * 1.45 * 100) / 100;
    expect(ventaLinea(l, recargos)).toBe(esperado);
  });
  it("el mínimo no afecta monto_fijo", () => {
    expect(ventaLinea({ ...expreso, tipo_margen: "monto_fijo", valor_margen: 1, minimo: 999999 }, recargos)).not.toBe(0);
  });
  it("precio_fijo también respeta el mínimo (para cuando el usuario normal ve el precio ya transformado)", () => {
    const l: LineaCalculo = { nombre: "x", categoria: "internacional", moneda: "USD", cantidad: 5, costo_unitario: 0, tipo_margen: "precio_fijo", valor_margen: 3.51, lleva_iva: false, minimo: 280.9 };
    expect(ventaLinea(l)).toBe(280.9); // 5*3.51=17.55, muy por debajo del mínimo → se cobra el mínimo
    expect(ventaLinea({ ...l, cantidad: 200 })).toBe(702); // 200*3.51=702, por encima del mínimo → normal
  });
});

describe("ventaUnitariaLista", () => {
  it("precio de 1 unidad, ignorando el mínimo (para mostrar '$X/lb')", () => {
    const l: LineaCalculo = {
      nombre: "x", categoria: "internacional", moneda: "USD", cantidad: 5, costo_unitario: 2.15,
      tipo_margen: "porcentaje", valor_margen: 45, lleva_iva: false, minimo: 172,
    };
    expect(ventaUnitariaLista(l)).toBe(3.12); // 2.15 * 1.45, sin recargos aquí
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
