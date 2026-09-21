import { listarCotizaciones } from "@/lib/cotizaciones/consultas";
import { calcularMetricas, type FilaMetrica, type Metricas } from "@/lib/cotizaciones/metricas";
import { formatoFecha } from "@/lib/calculo/formato";

export interface ResumenUsuario {
  filas: FilaMetrica[];
  metricas: Metricas;
}

/** Actividad de un usuario: todas sus cotizaciones (RLS ya limita a las suyas si no eres admin). */
export async function resumenUsuario(userId: string): Promise<ResumenUsuario> {
  const filas = await listarCotizaciones({ usuario: userId, limite: 1000 });
  const metricas = calcularMetricas(filas as unknown as FilaMetrica[]);
  return { filas, metricas };
}

const celdaCsv = (v: string | number) => {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV de todas las cotizaciones del resumen; incluye utilidad solo si `esAdmin`. */
export function resumenUsuarioACsv(resumen: ResumenUsuario, esAdmin: boolean): string {
  const encabezado = ["numero", "cliente", "fecha", "estado", "servicio", "monto_gtq", ...(esAdmin ? ["utilidad_gtq"] : [])];
  const filas = resumen.filas.map((f) => [
    f.numero, f.cliente_nombre, formatoFecha(f.fecha), f.estado_efectivo, f.tipos_servicio?.[0] ?? f.tipo_servicio, f.total_gtq,
    ...(esAdmin ? [f.utilidad_gtq] : []),
  ]);
  return [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(",")).join("\n");
}
