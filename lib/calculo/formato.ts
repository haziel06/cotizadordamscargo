import type { Moneda } from "./tipos";

const numero = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `$ 5,750.00` o `Q 9,750.00` (spec §8.4). */
export function formatoMoneda(monto: number, moneda: Moneda): string {
  const simbolo = moneda === "USD" ? "$" : "Q";
  const signo = monto < 0 ? "-" : "";
  return `${signo}${simbolo} ${numero.format(Math.abs(monto))}`;
}

/** `19.5%` con un decimal. */
export function formatoPorcentaje(pct: number): string {
  return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
}

/** Fecha ISO `AAAA-MM-DD` → `DD/MM/AAAA`. Sin zonas horarias: solo texto. */
export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** Fecha ISO `AAAA-MM-DD` → `17 de septiembre de 2026` (documentos para el cliente). */
export function formatoFechaLarga(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
}

/** Fecha ISO de vencimiento = fecha + días de vigencia. Calcula en UTC para no depender del huso. */
export function fechaVencimiento(fechaIso: string, dias: number): string {
  const [a, m, d] = fechaIso.slice(0, 10).split("-").map(Number);
  const t = Date.UTC(a, m - 1, d + dias);
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Hoy en ISO `AAAA-MM-DD` en hora de Guatemala (UTC-6, sin horario de verano). Se fija el huso porque el
 * servidor corre en UTC: sin esto, después de las 6 pm un tarifario "vence hoy" ya contaba como vencido
 * y las cotizaciones nuevas salían con la fecha de mañana.
 */
export function hoyIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
