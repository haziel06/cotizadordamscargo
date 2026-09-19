import { describe, expect, it } from "vitest";
import { alternarMarca, segmentar, textoPlano } from "../formato-texto";

describe("segmentar", () => {
  it("texto sin marcas", () => {
    expect(segmentar("Hola")).toEqual([{ texto: "Hola", negrita: false, subrayado: false, resaltado: false }]);
  });
  it("negrita + resaltado anidados como en la nota del seguro", () => {
    const s = segmentar("==**No incluye seguro** (0.80%)==");
    expect(s).toEqual([
      { texto: "No incluye seguro", negrita: true, subrayado: false, resaltado: true },
      { texto: " (0.80%)", negrita: false, subrayado: false, resaltado: true },
    ]);
  });
  it("subrayado", () => {
    expect(segmentar("a __b__ c").map((x) => [x.texto, x.subrayado])).toEqual([["a ", false], ["b", true], [" c", false]]);
  });
  it("textoPlano quita marcas", () => {
    expect(textoPlano("==**Hola**== mundo")).toBe("Hola mundo");
  });
});

describe("alternarMarca", () => {
  it("envuelve la selección", () => {
    expect(alternarMarca("hola mundo", 0, 4, "**")).toEqual({ texto: "**hola** mundo", ini: 2, fin: 6 });
  });
  it("quita la marca si la selección ya está envuelta", () => {
    expect(alternarMarca("**hola** mundo", 2, 6, "**")).toEqual({ texto: "hola mundo", ini: 0, fin: 4 });
  });
  it("quita la marca si la selección incluye las marcas", () => {
    expect(alternarMarca("**hola** mundo", 0, 8, "**")).toEqual({ texto: "hola mundo", ini: 0, fin: 4 });
  });
  it("sin selección no hace nada", () => {
    expect(alternarMarca("hola", 2, 2, "**")).toEqual({ texto: "hola", ini: 2, fin: 2 });
  });
});
