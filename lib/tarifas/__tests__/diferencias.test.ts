import { describe, expect, it } from "vitest";
import { calcularCambios, resumenCambios, type FilasExistentes } from "../diferencias";
import type { FilaExtraida } from "@/lib/ia/tarifarioIA";

const fila = (o: Partial<FilaExtraida>): FilaExtraida => ({ tipo: "ruta", nombre: "", pais: "", naviera: "", variante: "", origen: "", destino: "Puerto Quetzal", via: "", costo: 0, unidad: "contenedor", minimo: null, transito: "", notas: "", ...o });

const existentes: FilasExistentes = {
  rutas: [
    { id: "r1", origen: "Shanghai", via: null, variante: "20GP", naviera: "YML", costo: 6000, minimo: null },
    { id: "r2", origen: "Shanghai", via: null, variante: "40GP/HQ", naviera: "YML", costo: 6600, minimo: null },
    { id: "r3", origen: "Ningbo", via: null, variante: "20GP", naviera: "PIL", costo: 6950, minimo: null },
  ],
  conceptos: [{ id: "c1", nombre: "BL fee", costo: 85, minimo: null }, { id: "c2", nombre: "THC (40HQ)", costo: 300, minimo: null }],
};

describe("calcularCambios", () => {
  it("detecta nuevos, cambios y sin cambios; lo que no aparece no se toca", () => {
    const r = calcularCambios(existentes, [
      fila({ origen: "Shanghai", naviera: "YML", variante: "20GP", costo: 6300 }),
      fila({ origen: "Shanghai", naviera: "YML", variante: "40GP/HQ", costo: 6600 }),
      fila({ origen: "Qingdao", naviera: "YML", variante: "20GP", costo: 6900 }),
      fila({ tipo: "concepto", nombre: "BL fee", costo: 90 }),
      fila({ tipo: "concepto", nombre: "THC", variante: "40HQ", costo: 300 }),
    ]);
    expect(r.map((c) => c.estado)).toEqual(["cambia", "igual", "nuevo", "cambia", "igual"]);
    expect(r[0].existenteId).toBe("r1");
    expect(r[0].anterior?.costo).toBe(6000);
    expect(resumenCambios(r)).toEqual({ nuevos: 1, cambian: 2, iguales: 2 });
  });

  it("un documento recortado que dice «40HQ» actualiza la columna guardada como «40GP/HQ» (no duplica)", () => {
    const r = calcularCambios(existentes, [fila({ origen: "shanghai", naviera: "YML", variante: "40HQ", costo: 7100 })]);
    expect(r[0].estado).toBe("cambia");
    expect(r[0].existenteId).toBe("r2");
  });

  it("distingue navieras distintas en el mismo puerto", () => {
    const r = calcularCambios(existentes, [fila({ origen: "Shanghai", naviera: "HMM", variante: "20GP", costo: 6050 })]);
    expect(r[0].estado).toBe("nuevo");
  });

  it("reconoce filas viejas con la naviera y el tamaño juntos en «vía» y el origen abreviado", () => {
    const viejas: FilasExistentes = {
      conceptos: [],
      rutas: [
        { id: "a", origen: "nansha huangpu", via: "PIL 20GP", variante: null, costo: 7200, minimo: null },
        { id: "b", origen: "nansha huangpu", via: "PIL 40GP/HQ", variante: null, costo: 7300, minimo: null },
        { id: "c", origen: "qingdao", via: "YML 20GP", variante: null, costo: 6000, minimo: null },
        { id: "d", origen: "qingdao", via: "WHL NOR", variante: null, costo: 6000, minimo: null },
      ],
    };
    const r = calcularCambios(viejas, [
      fila({ origen: "Nansha", naviera: "PIL", variante: "20GP", costo: 7250 }),
      fila({ origen: "Qingdao", naviera: "YML", variante: "20GP", costo: 6000 }),
      fila({ origen: "Qingdao", naviera: "HMM", variante: "20GP", costo: 6050 }),
      fila({ origen: "Qingdao", naviera: "WHL", variante: "NOR", costo: 6100 }),
    ]);
    expect(r.map((c) => c.estado)).toEqual(["cambia", "igual", "nuevo", "cambia"]);
    expect(r[0].existenteId).toBe("a");
    expect(r[3].existenteId).toBe("d");
  });

  it("si el documento no trae naviera, solo reconoce una fila cuando es la única posible", () => {
    const una = calcularCambios({ conceptos: [], rutas: [{ id: "x", origen: "Yantián", via: null, variante: "40HQ", naviera: null, costo: 100, minimo: null }] }, [fila({ origen: "yantian", variante: "40HC", costo: 110 })]);
    expect(una[0].estado).toBe("cambia");
    const varias = calcularCambios(existentes, [fila({ origen: "Shanghai", variante: "20GP", costo: 1 })]);
    expect(varias[0].estado).toBe("cambia");
    const ambigua = calcularCambios({ conceptos: [], rutas: [{ id: "p", origen: "Qingdao", via: "PIL 20GP", variante: null, costo: 1, minimo: null }, { id: "q", origen: "Qingdao", via: "YML 20GP", variante: null, costo: 2, minimo: null }] }, [fila({ origen: "Qingdao", variante: "20GP", costo: 3 })]);
    expect(ambigua[0].estado).toBe("nuevo");
  });
});
