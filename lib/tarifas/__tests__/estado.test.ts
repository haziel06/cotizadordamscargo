import { describe, expect, it } from "vitest";
import { diasParaVencer, estadoTarifario, tarifarioUsable, textoVencimiento } from "../estado";

const t = (desde: string | null, hasta: string | null, archivado: string | null = null) => ({ vigencia_desde: desde, vigencia_hasta: hasta, archivado_at: archivado });
const HOY = "2026-10-22";

describe("estadoTarifario", () => {
  it("sin fechas = en uso, no vence", () => expect(estadoTarifario(t(null, null), HOY)).toBe("en_uso"));
  it("vence mañana = por vencer", () => expect(estadoTarifario(t(null, "2026-10-23"), HOY)).toBe("por_vencer"));
  it("vence hoy todavía se puede usar", () => {
    expect(estadoTarifario(t(null, HOY), HOY)).toBe("por_vencer");
    expect(tarifarioUsable(t(null, HOY), HOY)).toBe(true);
  });
  it("ayer venció = vencido y no se puede usar", () => {
    expect(estadoTarifario(t(null, "2026-10-21"), HOY)).toBe("vencido");
    expect(tarifarioUsable(t(null, "2026-10-21"), HOY)).toBe(false);
  });
  it("lejos de vencer = en uso", () => expect(estadoTarifario(t(null, "2026-12-31"), HOY)).toBe("en_uso"));
  it("aún no empieza = programado y no usable", () => {
    expect(estadoTarifario(t("2026-11-01", "2026-12-31"), HOY)).toBe("programado");
    expect(tarifarioUsable(t("2026-11-01", null), HOY)).toBe(false);
  });
  it("apagado a mano gana sobre las fechas", () => {
    expect(estadoTarifario(t(null, "2026-12-31", "2026-10-01T00:00:00Z"), HOY)).toBe("desactivado");
    expect(tarifarioUsable(t(null, null, "2026-10-01T00:00:00Z"), HOY)).toBe(false);
  });
});

describe("textos", () => {
  it("días para vencer", () => {
    expect(diasParaVencer(t(null, "2026-10-25"), HOY)).toBe(3);
    expect(diasParaVencer(t(null, null), HOY)).toBeNull();
  });
  it("frases", () => {
    expect(textoVencimiento(t(null, "2026-10-25"), HOY)).toBe("Vence en 3 días");
    expect(textoVencimiento(t(null, "2026-10-20"), HOY)).toBe("Venció hace 2 días");
    expect(textoVencimiento(t(null, null), HOY)).toMatch(/Sin fecha/);
  });
});
