import { fechaVencimiento } from "@/lib/calculo/formato";
import type { Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];
type TipoServicio = Database["public"]["Enums"]["tipo_servicio"];

/** Lo mínimo que necesita el panel de una cotización. */
export interface FilaMetrica {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha: string;
  dias_vigencia: number;
  estado_efectivo: Estado;
  total_gtq: number;
  utilidad_gtq: number;
  tipo_servicio: TipoServicio;
  tipos_servicio: TipoServicio[];
  creado_por: string | null;
  created_at: string;
}

export interface Metricas {
  porEstado: Record<Estado, number>;
  total: number;
  /** Mes en curso. */
  mes: { cotizadas: number; monto_gtq: number; aceptadas: number; monto_aceptado_gtq: number; utilidad_gtq: number };
  /** % de aceptadas sobre las que ya tuvieron respuesta (aceptadas + rechazadas + vencidas). */
  tasa_aceptacion: number;
  porDia: { dia: string; n: number }[];
  porMes: { mes: string; n: number; monto_gtq: number; aceptadas: number }[];
  porServicio: { servicio: TipoServicio; n: number; monto_gtq: number }[];
  porServicioTasa: { servicio: TipoServicio; aceptadas: number; respondidas: number; tasa: number }[];
  topClientes: { cliente: string; n: number; monto_gtq: number }[];
  porVencer: FilaMetrica[];
  ultimas: FilaMetrica[];
}

const ESTADOS: Estado[] = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Métricas del panel de inicio a partir de las cotizaciones visibles. `hoy` se inyecta para poder probar. */
export function calcularMetricas(filas: FilaMetrica[], hoy = new Date()): Metricas {
  const hoyIso = iso(hoy);
  const mesActual = hoyIso.slice(0, 7);
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  for (const f of filas) porEstado[f.estado_efectivo]++;

  const delMes = filas.filter((f) => f.fecha.startsWith(mesActual));
  const aceptadasMes = delMes.filter((f) => f.estado_efectivo === "aceptada");
  const mes = {
    cotizadas: delMes.length,
    monto_gtq: suma(delMes.map((f) => f.total_gtq)),
    aceptadas: aceptadasMes.length,
    monto_aceptado_gtq: suma(aceptadasMes.map((f) => f.total_gtq)),
    utilidad_gtq: suma(aceptadasMes.map((f) => f.utilidad_gtq)),
  };

  const respondidas = porEstado.aceptada + porEstado.rechazada + porEstado.vencida;
  const tasa_aceptacion = respondidas ? Math.round((porEstado.aceptada / respondidas) * 1000) / 10 : 0;

  // Últimos 30 días, incluyendo los días sin cotizaciones.
  const porDia: Metricas["porDia"] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    const dia = iso(d);
    porDia.push({ dia, n: filas.filter((f) => f.fecha === dia).length });
  }

  // Últimos 12 meses.
  const porMes: Metricas["porMes"] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const del = filas.filter((f) => f.fecha.startsWith(m));
    porMes.push({ mes: m, n: del.length, monto_gtq: suma(del.map((f) => f.total_gtq)), aceptadas: del.filter((f) => f.estado_efectivo === "aceptada").length });
  }

  const porServicioMap = new Map<TipoServicio, { n: number; monto_gtq: number }>();
  for (const f of filas) {
    const t = f.tipos_servicio?.[0] ?? f.tipo_servicio;
    const x = porServicioMap.get(t) ?? { n: 0, monto_gtq: 0 };
    porServicioMap.set(t, { n: x.n + 1, monto_gtq: x.monto_gtq + f.total_gtq });
  }
  const porServicio = [...porServicioMap.entries()].map(([servicio, v]) => ({ servicio, ...v })).sort((a, b) => b.n - a.n);

  const porServicioTasa = [...porServicioMap.keys()].map((servicio) => {
    const del = filas.filter((f) => (f.tipos_servicio?.[0] ?? f.tipo_servicio) === servicio);
    const aceptadas = del.filter((f) => f.estado_efectivo === "aceptada").length;
    const respondidas = del.filter((f) => ["aceptada", "rechazada", "vencida"].includes(f.estado_efectivo)).length;
    return { servicio, aceptadas, respondidas, tasa: respondidas ? Math.round((aceptadas / respondidas) * 100) : 0 };
  }).sort((a, b) => b.respondidas - a.respondidas);

  const clientesMap = new Map<string, { n: number; monto_gtq: number }>();
  for (const f of filas) {
    const k = f.cliente_nombre.trim();
    const x = clientesMap.get(k) ?? { n: 0, monto_gtq: 0 };
    clientesMap.set(k, { n: x.n + 1, monto_gtq: x.monto_gtq + f.total_gtq });
  }
  const topClientes = [...clientesMap.entries()].map(([cliente, v]) => ({ cliente, ...v })).sort((a, b) => b.monto_gtq - a.monto_gtq).slice(0, 6);

  const en7 = iso(new Date(hoy.getTime() + 7 * 86400000));
  const porVencer = filas
    .filter((f) => (f.estado_efectivo === "enviada" || f.estado_efectivo === "borrador") && fechaVencimiento(f.fecha, f.dias_vigencia) >= hoyIso && fechaVencimiento(f.fecha, f.dias_vigencia) <= en7)
    .sort((a, b) => fechaVencimiento(a.fecha, a.dias_vigencia).localeCompare(fechaVencimiento(b.fecha, b.dias_vigencia)))
    .slice(0, 8);
  const ultimas = [...filas].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);

  return { porEstado, total: filas.length, mes, tasa_aceptacion, porDia, porMes, porServicio, porServicioTasa, topClientes, porVencer, ultimas };
}

const suma = (xs: number[]) => Math.round(xs.reduce((s, x) => s + x, 0) * 100) / 100;
