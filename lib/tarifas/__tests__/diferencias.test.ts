import { describe, expect, it } from "vitest";
import { calcularCambios, resumenCambios, type FilasExistentes } from "../diferencias";
import type { FilaExtraida } from "@/lib/ia/tarifarioIA";

const fila = (o: Partial<FilaExtraida>): FilaExtraida => ({ tipo: "ruta", nombre: "", pais: "", variante: "", origen: "", destino: "Puerto Quetzal", via: "", costo: 0, unidad: "contenedor", minimo: null, transito: "", notas: "", ...o });

const existentes: FilasExistentes = {
  rutas: [
    { id: "r1", origen: "Shanghai", via: null, variante: "20GP", costo: 2450, minimo: null },
    { id: "r2", origen: "Shanghai", via: null, variante: "40HQ", costo: 3700, minimo: null },
    { id: "r3", origen: "Ningbo", via: null, variante: "20GP", costo: 2450, minimo: null },
  ],
  conceptos: [{ id: "c1", nombre: "BL fee", costo: 85, minimo: null }, { id: "c2", nombre: "THC (40HQ)", costo: 300, minimo: null }],
};

describe("calcularCambios", () => {
  it("detecta nuevos, cambios y sin cambios; lo que no aparece no se toca", () => {
    const r = calcularCambios(existentes, [
      fila({ origen: "Shanghai", variante: "20GP", costo: 2500 }),
      fila({ origen: "Shanghai", variante: "40hc", costo: 3700 }),
      fila({ origen: "Qingdao", variante: "20GP", costo: 2550 }),
      fila({ tipo: "concepto", nombre: "BL fee", costo: 90 }),
      fila({ tipo: "concepto", nombre: "THC", variante: "40HQ", costo: 300 }),
    ]);
    expect(r.map((c) => c.estado)).toEqual(["cambia", "igual", "nuevo", "cambia", "igual"]);
    expect(r[0].existenteId).toBe("r1");
    expect(r[0].anterior?.costo).toBe(2450);
    expect(r[2].existenteId).toBeNull();
    expect(resumenCambios(r)).toEqual({ nuevos: 1, cambian: 2, iguales: 2 });
  });

  it("40HQ y 40HC son el mismo contenedor y los acentos no importan", () => {
    const r = calcularCambios({ ...existentes, rutas: [{ id: "x", origen: "Yantián", via: null, variante: "40HQ", costo: 100, minimo: null }] }, [fila({ origen: "yantian", variante: "40HC", costo: 110 })]);
    expect(r[0].estado).toBe("cambia");
  });

  it("reconoce filas viejas con la naviera y el tamaño juntos en «vía» y el origen abreviado", () => {
    const viejas: FilasExistentes = {
      conceptos: [],
      rutas: [
        { id: "a", origen: "nansha huangpu", via: "PIL 20GP", variante: null, costo: 7200, minimo: null },
        { id: "b", origen: "nansha huangpu", via: "PIL 40GP/HQ", variante: null, costo: 7300, minimo: null },
        { id: "c", origen: "qingdao", via: "YML 20GP", variante: null, costo: 6000, minimo: null },
      ],
    };
    const r = calcularCambios(viejas, [
      fila({ origen: "Nansha", via: "PIL", variante: "20GP", costo: 7250 }),
      fila({ origen: "Qingdao", via: "YML", variante: "20GP", costo: 6000 }),
      fila({ origen: "Qingdao", via: "HMM", variante: "20GP", costo: 6050 }),
    ]);
    expect(r.map((c) => c.estado)).toEqual(["cambia", "igual", "nuevo"]);
    expect(r[0].existenteId).toBe("a");
  });
});
