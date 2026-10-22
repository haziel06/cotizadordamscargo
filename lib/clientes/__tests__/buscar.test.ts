import { describe, expect, it } from "vitest";
import { clientesSimilares, nombreSimilar } from "../buscar";

describe("nombreSimilar", () => {
  it("un error de una letra no hace desaparecer al cliente (Cemaco vs camaco)", () => {
    expect(nombreSimilar("Cemaco", "camaco")).toBe(true);
    expect(nombreSimilar("CEMACO", "Camaco S.A.")).toBe(true);
  });
  it("ignora acentos, mayúsculas y símbolos", () => {
    expect(nombreSimilar("panda comida china", "Panda comidachina  S.A")).toBe(false);
    expect(nombreSimilar("proteína", "protein .S.A")).toBe(true);
    expect(nombreSimilar("gomitas", "Gomitas S.A.")).toBe(true);
  });
  it("no mezcla clientes distintos", () => {
    expect(nombreSimilar("Cemaco", "Gomitas pro")).toBe(false);
    expect(nombreSimilar("Cemaco", "Porteina")).toBe(false);
    expect(nombreSimilar("Panda", "Pandora")).toBe(false);
  });
  it("palabras cortas deben ser exactas", () => {
    expect(nombreSimilar("sol", "sal")).toBe(false);
  });
});

describe("clientesSimilares", () => {
  const lista = [{ nombre: "Gomitas pro", empresa: "Gomitas S.A." }, { nombre: "camaco", empresa: null }, { nombre: "Camacho Hermanos", empresa: null }];
  it("encuentra por nombre o empresa y deja primero el idéntico", () => {
    expect(clientesSimilares("Gomitas", lista).map((c) => c.nombre)).toEqual(["Gomitas pro"]);
    expect(clientesSimilares("camaco", lista)[0].nombre).toBe("camaco");
  });
});
