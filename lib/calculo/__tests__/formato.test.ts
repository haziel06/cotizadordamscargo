import { describe, expect, it } from "vitest";
import { fechaVencimiento, formatoFecha, formatoMoneda, formatoPorcentaje } from "../formato";

describe("formato", () => {
  it("moneda USD", () => expect(formatoMoneda(5750, "USD")).toBe("$ 5,750.00"));
  it("moneda GTQ", () => expect(formatoMoneda(9750, "GTQ")).toBe("Q 9,750.00"));
  it("moneda grande", () => expect(formatoMoneda(1234567.891, "GTQ")).toBe("Q 1,234,567.89"));
  it("moneda negativa", () => expect(formatoMoneda(-12.5, "GTQ")).toBe("-Q 12.50"));
  it("fecha DD/MM/AAAA", () => expect(formatoFecha("2026-09-18")).toBe("18/09/2026"));
  it("vencimiento suma días", () => expect(fechaVencimiento("2026-09-18", 15)).toBe("2026-10-03"));
  it("vencimiento cruza año", () => expect(fechaVencimiento("2026-12-25", 15)).toBe("2027-01-09"));
  it("porcentaje", () => expect(formatoPorcentaje(19.456)).toBe("19.5%"));
});
