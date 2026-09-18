import { describe, expect, it } from "vitest";
import { pesoCobrable } from "../peso";

describe("pesoCobrable", () => {
  it("gana el real", () => expect(pesoCobrable(120, 80)).toEqual({ peso: 120, gano: "real" }));
  it("gana el volumétrico", () => expect(pesoCobrable(80, 120)).toEqual({ peso: 120, gano: "volumetrico" }));
  it("empate", () => expect(pesoCobrable(100, 100)).toEqual({ peso: 100, gano: "empate" }));
  it("nulos cuentan como 0", () => expect(pesoCobrable(null, 50)).toEqual({ peso: 50, gano: "volumetrico" }));
});
