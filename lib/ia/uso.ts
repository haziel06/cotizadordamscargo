import { crearClienteServidor } from "@/lib/supabase/server";

export interface ResumenUsoIA {
  total: number;
  exitos: number;
  porProveedor: { proveedor: string; llamadas: number; exitos: number }[];
  ultimosErrores: { proveedor: string; tipo_error: string | null; created_at: string }[];
}

/** Resumen de las últimas ~500 llamadas al asistente/lector de IA, para ver si está funcionando bien. */
export async function resumenUsoIA(): Promise<ResumenUsoIA> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("ai_usage").select("proveedor, exito, tipo_error, created_at").order("created_at", { ascending: false }).limit(500);
  const filas = data ?? [];

  const porProveedorMap = new Map<string, { llamadas: number; exitos: number }>();
  for (const f of filas) {
    const x = porProveedorMap.get(f.proveedor) ?? { llamadas: 0, exitos: 0 };
    x.llamadas++;
    if (f.exito) x.exitos++;
    porProveedorMap.set(f.proveedor, x);
  }

  return {
    total: filas.length,
    exitos: filas.filter((f) => f.exito).length,
    porProveedor: [...porProveedorMap.entries()].map(([proveedor, v]) => ({ proveedor, ...v })),
    ultimosErrores: filas.filter((f) => !f.exito).slice(0, 8).map((f) => ({ proveedor: f.proveedor, tipo_error: f.tipo_error, created_at: f.created_at })),
  };
}
