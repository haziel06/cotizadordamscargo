import { describe, expect, it } from "vitest";
import { cantidadPorUnidad, conceptoAplicaAServicio, conceptosCourier } from "../armado";
import { aContenidosGemini } from "@/lib/ia/proveedores/gemini";
import type { Concepto } from "@/lib/supabase/tipos";

const c = (o: Partial<Concepto>): Concepto => ({ id: "x", nombre: "x", seccion: "courier", unidad: "libra", costo: 0, valor_margen: 0, cuenta_ajena: false, rango_desde: null, rango_hasta: null, ...o }) as Concepto;

describe("conceptosCourier", () => {
  const libra = c({ id: "libra" });
  const entregaIncluida = c({ id: "e1", seccion: "entrega_domicilio", unidad: "envio", rango_desde: 0, rango_hasta: 132 });
  const entregaGrande = c({ id: "e2", seccion: "entrega_domicilio", unidad: "envio", rango_desde: 133, rango_hasta: null, costo: 10 });
  const tramite = c({ id: "t", seccion: "documentacion", nombre: "Trámite aduanero courier" });
  const almacenaje = c({ id: "a", seccion: "gastos_ajenos", cuenta_ajena: true });
  const todos = [libra, entregaIncluida, entregaGrande, tramite, almacenaje];

  it("consolidado: libra + la entrega que corresponde al peso", () => {
    const r = conceptosCourier(todos, { segmento: "consolidado", pesoCobrable: 10, yaMarcados: new Set() });
    expect(r.map((x) => x.id)).toEqual(["libra", "e1"]);
  });

  it("peso grande usa la entrega de rango alto", () => {
    const r = conceptosCourier(todos, { segmento: "consolidado", pesoCobrable: 100, yaMarcados: new Set() });
    expect(r.map((x) => x.id)).toEqual(["libra", "e2"]);
  });

  it("ticket suma trámite y pagos a terceros", () => {
    const r = conceptosCourier(todos, { segmento: "ticket", pesoCobrable: 10, yaMarcados: new Set() });
    expect(r.map((x) => x.id)).toEqual(["libra", "e1", "t", "a"]);
  });

  it("no repite lo que ya está en la cotización", () => {
    const r = conceptosCourier(todos, { segmento: "ticket", pesoCobrable: 10, yaMarcados: new Set(["libra", "t"]) });
    expect(r.map((x) => x.id)).toEqual(["e1", "a"]);
  });
});

describe("cantidadPorUnidad", () => {
  it("libras a partir de kg", () => expect(cantidadPorUnidad("libra", 10, 0)).toBe(22.05));
  it("sin medidas devuelve 1", () => expect(cantidadPorUnidad("kg", 0, 0)).toBe(1));
});

describe("aContenidosGemini", () => {
  it("junta resultados de herramientas consecutivos en un solo turno y reenvía las partes crudas", () => {
    const crudas = [{ functionCall: { name: "a", args: {} }, thoughtSignature: "firma" }, { functionCall: { name: "b", args: {} } }];
    const r = aContenidosGemini([
      { role: "system", content: "s" },
      { role: "user", content: "hola" },
      { role: "assistant", content: "", partes_crudas: crudas, tool_calls: [] },
      { role: "tool", tool_call_id: "1", nombre: "a", content: '{"ok":1}' },
      { role: "tool", tool_call_id: "2", nombre: "b", content: "texto" },
    ]);
    expect(r).toHaveLength(3);
    expect(r[1]).toEqual({ role: "model", parts: crudas });
    expect(r[2].role).toBe("user");
    expect(r[2].parts).toHaveLength(2);
    expect(r[2].parts[0]).toEqual({ functionResponse: { name: "a", response: { resultado: { ok: 1 } } } });
  });
});

describe("conceptoAplicaAServicio", () => {
  it("hereda el servicio del tarifario: TACSA LCL no sale en un FCL", () => {
    expect(conceptoAplicaAServicio({ servicios: [] }, "maritimo_lcl", ["maritimo_fcl"])).toBe(false);
    expect(conceptoAplicaAServicio({ servicios: [] }, "maritimo_lcl", ["maritimo_lcl"])).toBe(true);
  });
  it("sin servicio en tarifario ni concepto sirve para todo", () => {
    expect(conceptoAplicaAServicio({ servicios: null }, null, ["maritimo_fcl"])).toBe(true);
  });
  it("lo que declara el concepto manda sobre el tarifario", () => {
    expect(conceptoAplicaAServicio({ servicios: ["courier"] }, null, ["maritimo_fcl"])).toBe(false);
    expect(conceptoAplicaAServicio({ servicios: ["maritimo_fcl"] }, "courier", ["maritimo_fcl"])).toBe(true);
  });
});
