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

/** Hoy en ISO `AAAA-MM-DD` según el reloj local. */
export function hoyIso(): string {
  const h = new Date();
  const mm = String(h.getMonth() + 1).padStart(2, "0");
  const dd = String(h.getDate()).padStart(2, "0");
  return `${h.getFullYear()}-${mm}-${dd}`;
}
