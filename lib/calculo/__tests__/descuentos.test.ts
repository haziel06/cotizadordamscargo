import { describe, expect, it } from "vitest";
import { aplicarDescuentos, type Descuento } from "../descuentos";
import type { LineaCalculo } from "../tipos";

type Req = Pick<LineaCalculo, "nombre" | "categoria" | "moneda" | "costo_unitario" | "tipo_margen" | "valor_margen">;
const L = (p: Partial<LineaCalculo> & Req): LineaCalculo => ({ cantidad: 1, lleva_iva: true, ...p });

// Ventas: internacional 1000 + 500 = 1500 USD; local 800 Q; naviera 200 USD
const lineas: LineaCalculo[] = [
  L({ nombre: "Flete", categoria: "internacional", moneda: "USD", costo_unitario: 1000, tipo_margen: "precio_fijo", valor_margen: 1000 }),
  L({ nombre: "BL", categoria: "internacional", moneda: "USD", costo_unitario: 500, tipo_margen: "precio_fijo", valor_margen: 500 }),
  L({ nombre: "Aduana", categoria: "local", moneda: "GTQ", costo_unitario: 800, tipo_margen: "precio_fijo", valor_margen: 800 }),
  L({ nombre: "Depósito", categoria: "naviera", moneda: "USD", costo_unitario: 200, tipo_margen: "precio_fijo", valor_margen: 200, lleva_iva: false }),
];

describe("aplicarDescuentos", () => {
  it("sin descuentos: ventas iguales y descuento 0", () => {
    const r = aplicarDescuentos(lineas, [], 8);
    expect(r.ventas).toEqual([1000, 500, 800, 200]);
    expect(r.descuento_por_bloque).toEqual({ internacional: 0, local: 0, naviera: 0 });
    expect(r.descuento_total_gtq).toBe(0);
  });

  it("porcentaje sobre un bloque se reparte proporcional entre sus líneas", () => {
    const d: Descuento[] = [{ ambito: "internacional", tipo: "porcentaje", valor: 10 }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.ventas).toEqual([900, 450, 800, 200]);
    expect(r.descuento_por_bloque.internacional).toBe(150);
    expect(r.descuento_total_gtq).toBe(1200);
  });

  it("monto fijo en la moneda del bloque", () => {
    const d: Descuento[] = [{ ambito: "local", tipo: "monto", valor: 100 }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.ventas[2]).toBe(700);
    expect(r.descuento_por_bloque.local).toBe(100);
    expect(r.descuento_total_gtq).toBe(100);
  });

  it("monto mayor que el bloque se limita al bloque", () => {
    const d: Descuento[] = [{ ambito: "naviera", tipo: "monto", valor: 999 }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.ventas[3]).toBe(0);
    expect(r.descuento_por_bloque.naviera).toBe(200);
  });

  it("descuento al total en Q se reparte entre bloques según su peso en Q", () => {
    // Total en Q: 1500*8 + 800 + 200*8 = 12000 + 800 + 1600 = 14400. 10% = 1440 Q.
    const d: Descuento[] = [{ ambito: "total", tipo: "porcentaje", valor: 10 }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.ventas).toEqual([900, 450, 720, 180]);
    expect(r.descuento_total_gtq).toBe(1440);
  });

  it("descuento al total como monto en Q", () => {
    // 1440 Q = 10% del total → mismo resultado que arriba
    const d: Descuento[] = [{ ambito: "total", tipo: "monto", valor: 1440, moneda: "GTQ" }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.ventas).toEqual([900, 450, 720, 180]);
  });

  it("descuento al total como monto en USD se convierte con el tipo de cambio", () => {
    const d: Descuento[] = [{ ambito: "total", tipo: "monto", valor: 180, moneda: "USD" }];
    const r = aplicarDescuentos(lineas, d, 8);
    expect(r.descuento_total_gtq).toBe(1440);
    expect(r.ventas).toEqual([900, 450, 720, 180]);
  });

  it("el reparto absorbe el redondeo en la última línea para que sume exacto", () => {
    const tres: LineaCalculo[] = [
      L({ nombre: "a", categoria: "local", moneda: "GTQ", costo_unitario: 10, tipo_margen: "precio_fijo", valor_margen: 10 }),
      L({ nombre: "b", categoria: "local", moneda: "GTQ", costo_unitario: 10, tipo_margen: "precio_fijo", valor_margen: 10 }),
      L({ nombre: "c", categoria: "local", moneda: "GTQ", costo_unitario: 10, tipo_margen: "precio_fijo", valor_margen: 10 }),
    ];
    const r = aplicarDescuentos(tres, [{ ambito: "local", tipo: "monto", valor: 1 }], 8);
    expect(r.ventas.reduce((a, b) => a + b, 0)).toBe(29);
    expect(r.descuento_por_bloque.local).toBe(1);
  });

  it("varios descuentos se acumulan (bloque y total)", () => {
    const d: Descuento[] = [
      { ambito: "internacional", tipo: "monto", valor: 500 },
      { ambito: "total", tipo: "porcentaje", valor: 10 },
    ];
    const r = aplicarDescuentos(lineas, d, 8);
    // Tras el primero: internacional 1000 USD (666.67 + 333.33), local 800, naviera 200
    // Total Q = 8000 + 800 + 1600 = 10400; 10% = 1040 → internacional -100 USD, local -80 Q, naviera -20 USD
    expect(r.descuento_por_bloque.internacional).toBe(600);
    expect(r.descuento_por_bloque.local).toBe(80);
    expect(r.descuento_por_bloque.naviera).toBe(20);
    expect(r.ventas[2]).toBe(720);
    expect(r.ventas[3]).toBe(180);
    expect(r.ventas[0] + r.ventas[1]).toBe(900);
  });
});
