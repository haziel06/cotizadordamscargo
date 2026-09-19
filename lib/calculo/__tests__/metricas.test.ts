import { describe, expect, it } from "vitest";
import { calcularMetricas, type FilaMetrica } from "@/lib/cotizaciones/metricas";

const fila = (p: Partial<FilaMetrica>): FilaMetrica => ({
  id: p.id ?? Math.random().toString(36), numero: "COT-2026-0001", cliente_nombre: "ACME", fecha: "2026-09-10", dias_vigencia: 15,
  estado_efectivo: "enviada", total_gtq: 1000, utilidad_gtq: 200, tipo_servicio: "courier", tipos_servicio: ["courier"],
  creado_por: null, created_at: "2026-09-10T10:00:00Z", ...p,
});
const hoy = new Date("2026-09-19T12:00:00Z");

describe("calcularMetricas", () => {
  it("cuenta por estado y calcula el mes en curso", () => {
    const m = calcularMetricas([
      fila({ estado_efectivo: "aceptada", total_gtq: 500, utilidad_gtq: 100 }),
      fila({ estado_efectivo: "rechazada" }),
      fila({ estado_efectivo: "borrador", fecha: "2026-08-01" }),
    ], hoy);
    expect(m.porEstado).toEqual({ borrador: 1, enviada: 0, aceptada: 1, rechazada: 1, vencida: 0 });
    expect(m.mes).toEqual({ cotizadas: 2, monto_gtq: 1500, aceptadas: 1, monto_aceptado_gtq: 500, utilidad_gtq: 100 });
    expect(m.tasa_aceptacion).toBe(50);
  });
  it("30 días y 12 meses siempre completos", () => {
    const m = calcularMetricas([fila({})], hoy);
    expect(m.porDia).toHaveLength(30);
    expect(m.porDia.at(-1)?.dia).toBe("2026-09-19");
    expect(m.porMes).toHaveLength(12);
    expect(m.porMes.at(-1)).toEqual({ mes: "2026-09", n: 1, monto_gtq: 1000, aceptadas: 0 });
  });
  it("por vencer: enviadas que vencen en los próximos 7 días", () => {
    const m = calcularMetricas([
      fila({ id: "a", fecha: "2026-09-08", dias_vigencia: 15 }), // vence 23/09 → sí
      fila({ id: "b", fecha: "2026-09-01", dias_vigencia: 10 }), // ya vencida por fecha → no
      fila({ id: "c", fecha: "2026-09-18", dias_vigencia: 30 }), // vence en octubre → no
    ], hoy);
    expect(m.porVencer.map((f) => f.id)).toEqual(["a"]);
  });
});
