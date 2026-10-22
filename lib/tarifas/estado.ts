import { hoyIso } from "@/lib/calculo/formato";

/**
 * Estado de un tarifario, en un solo lugar para que lista, editor de cotización, servidor y asistente
 * digan lo mismo:
 * - `desactivado`: alguien lo apagó a mano (archivado).
 * - `vencido`: la fecha "vigente hasta" ya pasó. Ese día aún cuenta; vence al día siguiente. Se apaga solo.
 * - `programado`: todavía no llega su fecha "vigente desde".
 * - `por_vencer`: se usa, pero vence en 5 días o menos.
 * - `en_uso`: disponible para cotizar (sin fecha = no vence nunca).
 */
export type EstadoTarifario = "en_uso" | "por_vencer" | "vencido" | "programado" | "desactivado";

export interface FechasTarifario {
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  archivado_at: string | null;
}

export const DIAS_AVISO_VENCIMIENTO = 5;

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function estadoTarifario(t: FechasTarifario, hoy = hoyIso()): EstadoTarifario {
  if (t.archivado_at) return "desactivado";
  if (t.vigencia_hasta && t.vigencia_hasta < hoy) return "vencido";
  if (t.vigencia_desde && t.vigencia_desde > hoy) return "programado";
  if (t.vigencia_hasta && diasEntre(hoy, t.vigencia_hasta) <= DIAS_AVISO_VENCIMIENTO) return "por_vencer";
  return "en_uso";
}

/** Solo los tarifarios en uso (o por vencer) pueden entrar a una cotización nueva. */
export function tarifarioUsable(t: FechasTarifario, hoy = hoyIso()): boolean {
  const e = estadoTarifario(t, hoy);
  return e === "en_uso" || e === "por_vencer";
}

/** Días que faltan para que venza (0 = vence hoy, negativo = ya venció); null si no tiene fecha. */
export function diasParaVencer(t: Pick<FechasTarifario, "vigencia_hasta">, hoy = hoyIso()): number | null {
  return t.vigencia_hasta ? diasEntre(hoy, t.vigencia_hasta) : null;
}

export const ETIQUETA_ESTADO: Record<EstadoTarifario, { texto: string; clase: string }> = {
  en_uso: { texto: "En uso", clase: "bg-green-100 text-green-900" },
  por_vencer: { texto: "Por vencer", clase: "bg-amber-100 text-amber-900" },
  vencido: { texto: "Vencido", clase: "bg-red-100 text-red-900" },
  programado: { texto: "Aún no vigente", clase: "bg-sky-100 text-sky-900" },
  desactivado: { texto: "Desactivado", clase: "bg-muted text-muted-foreground" },
};

/** Frase corta que explica el estado en lenguaje de oficina. */
export function textoVencimiento(t: FechasTarifario, hoy = hoyIso()): string {
  const e = estadoTarifario(t, hoy);
  const d = diasParaVencer(t, hoy);
  if (e === "programado") return `Empieza el ${t.vigencia_desde}`;
  if (d === null) return "Sin fecha de vencimiento: no vence solo";
  if (d < 0) return `Venció hace ${-d} ${-d === 1 ? "día" : "días"}`;
  if (d === 0) return "Vence hoy (último día de uso)";
  return `Vence en ${d} ${d === 1 ? "día" : "días"}`;
}
