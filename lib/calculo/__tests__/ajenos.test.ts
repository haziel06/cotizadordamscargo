import { describe, expect, it } from "vitest";
import { totalesCotizacion } from "../totales";
import { alertasCotizacion } from "../alertas";
import type { LineaCalculo } from "../tipos";

const courier: LineaCalculo = { nombre: "Courier", categoria: "internacional", moneda: "USD", cantidad: 10, costo_unitario: 2.3, tipo_margen: "porcentaje", valor_margen: 42.83, lleva_iva: false, aplica_recargos: true };
const combex: LineaCalculo = { nombre: "Almacenaje Combex", categoria: "local", moneda: "GTQ", cantidad: 1, costo_unitario: 0, tipo_margen: "precio_fijo", valor_margen: 250, lleva_iva: false, cuenta_ajena: true };
const recargos = { isr_pct: 7, no_domiciliada_pct: 5.263 };

describe("courier y cuenta ajena", () => {
  it("courier consolidado: 2.30/lb con recargos y 42.83% da $3.70/lb", () => {
    const t = totalesCotizacion([courier], 8, [], recargos);
    expect(t.internacional_usd).toBe(37);
  });
  it("los pagos a terceros van aparte: no suman al total ni a la utilidad", () => {
    const t = totalesCotizacion([courier, combex], 8, [], recargos);
    expect(t.local_gtq).toBe(0);
    expect(t.total_gtq).toBe(296);
    expect(t.ajenos_gtq).toBe(250);
    expect(t.ajenos_usd).toBe(0);
    expect(t.costo_total_gtq).toBe(184);
  });
  it("los descuentos no tocan la cuenta ajena", () => {
    const t = totalesCotizacion([courier, combex], 8, [{ ambito: "total", tipo: "porcentaje", valor: 10 }], recargos);
    expect(t.ajenos_gtq).toBe(250);
    expect(t.total_gtq).toBe(266.4);
  });
  it("una línea en USD dentro de gastos locales se convierte a Q en el bloque", () => {
    const entrega: LineaCalculo = { nombre: "Entrega", categoria: "local", moneda: "USD", cantidad: 1, costo_unitario: 0, tipo_margen: "precio_fijo", valor_margen: 20, lleva_iva: true };
    const t = totalesCotizacion([entrega], 8);
    expect(t.local_gtq).toBe(160);
    expect(t.total_gtq).toBe(160);
  });
  it("sobrepeso: alerta a partir de 21,000 kg", () => {
    expect(alertasCotizacion({ margen_pct: 40, tipo_cambio: 8, lineas: [courier], kilogramos: 21000 }).some((a) => a.tipo === "sobrepeso")).toBe(false);
    expect(alertasCotizacion({ margen_pct: 40, tipo_cambio: 8, lineas: [courier], kilogramos: 21500 }).some((a) => a.tipo === "sobrepeso")).toBe(true);
  });
});
