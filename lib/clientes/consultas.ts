import { crearClienteServidor } from "@/lib/supabase/server";
import { soloVenta } from "@/lib/tarifas/consultas";
import { leerConfig } from "@/lib/config";
import type { Cliente, Concepto } from "@/lib/supabase/tipos";

export interface TarifaClienteFila {
  id: string;
  concepto_id: string;
  concepto_nombre: string;
  seccion: string;
  moneda: Concepto["moneda"];
  unidad: Concepto["unidad"];
  tipo_margen: Concepto["tipo_margen"];
  valor_margen: number;
  notas: string | null;
}

export async function listarClientes(): Promise<Cliente[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("clientes").select("*").order("nombre");
  return data ?? [];
}

/** Cliente + sus tarifas especiales, con el nombre del concepto ya resuelto (para admin: valores reales). */
export async function obtenerCliente(id: string): Promise<{ cliente: Cliente; tarifas: TarifaClienteFila[] } | null> {
  const supabase = await crearClienteServidor();
  const [{ data: cliente }, { data: tarifas }] = await Promise.all([
    supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("tarifas_cliente").select("id, concepto_id, tipo_margen, valor_margen, notas, conceptos(nombre, seccion, moneda, unidad)").eq("cliente_id", id),
  ]);
  if (!cliente) return null;
  return {
    cliente,
    tarifas: (tarifas ?? []).map((t) => {
      const c = t.conceptos as unknown as { nombre: string; seccion: string; moneda: Concepto["moneda"]; unidad: Concepto["unidad"] } | null;
      return {
        id: t.id, concepto_id: t.concepto_id, concepto_nombre: c?.nombre ?? "(concepto borrado)", seccion: c?.seccion ?? "",
        moneda: c?.moneda ?? "USD", unidad: c?.unidad ?? "envio", tipo_margen: t.tipo_margen, valor_margen: Number(t.valor_margen), notas: t.notas,
      };
    }),
  };
}

/**
 * Tarifas especiales de un cliente, listas para usarse al armar una cotización: para usuario
 * normal ya vienen convertidas a precio de venta (igual criterio que `catalogoParaCotizar`),
 * nunca se le manda el costo real ni la fórmula.
 */
export async function tarifasEspecialesCliente(clienteId: string | null, opciones: { ocultarCostos?: boolean } = {}): Promise<Map<string, { tipo_margen: Concepto["tipo_margen"]; valor_margen: number }>> {
  if (!clienteId) return new Map();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("tarifas_cliente")
    .select("concepto_id, tipo_margen, valor_margen, conceptos(costo, categoria, moneda, aplica_recargos, minimo)")
    .eq("cliente_id", clienteId);
  if (!data?.length) return new Map();

  const mapa = new Map<string, { tipo_margen: Concepto["tipo_margen"]; valor_margen: number }>();
  if (!opciones.ocultarCostos) {
    for (const t of data) mapa.set(t.concepto_id, { tipo_margen: t.tipo_margen, valor_margen: Number(t.valor_margen) });
    return mapa;
  }

  const { recargos } = await leerConfig();
  for (const t of data) {
    const c = t.conceptos as unknown as { costo: number; categoria: Concepto["categoria"]; moneda: Concepto["moneda"]; aplica_recargos: boolean; minimo: number | null } | null;
    if (!c) continue;
    const venta = soloVenta({ tipo_margen: t.tipo_margen, valor_margen: Number(t.valor_margen), aplica_recargos: c.aplica_recargos, minimo: c.minimo }, Number(c.costo), c.categoria, c.moneda, recargos);
    mapa.set(t.concepto_id, { tipo_margen: venta.tipo_margen, valor_margen: venta.valor_margen });
  }
  return mapa;
}
