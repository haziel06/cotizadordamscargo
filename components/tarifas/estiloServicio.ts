import { Anchor, FileText, Home, Landmark, Package, Plane, ShieldCheck, Ship, ShoppingCart, Truck, Users, Warehouse, type LucideIcon } from "lucide-react";

export interface EstiloServicio {
  icono: LucideIcon;
  /** Borde izquierdo de la tarjeta. */
  barra: string;
  /** Insignia (icono + nombre del servicio). */
  chip: string;
  /** Franja del encabezado de grupo. */
  banner: string;
}

/** Cada servicio con su color e ícono, para distinguirlos de un vistazo y no solo por la palabra. Clases escritas completas para Tailwind. */
export const ESTILO_SECCION: Record<string, EstiloServicio> = {
  flete_maritimo: { icono: Ship, barra: "border-l-blue-600", chip: "bg-blue-100 text-blue-900", banner: "bg-blue-50 text-blue-900 border-blue-200" },
  flete_aereo: { icono: Plane, barra: "border-l-cyan-600", chip: "bg-cyan-100 text-cyan-900", banner: "bg-cyan-50 text-cyan-900 border-cyan-200" },
  courier: { icono: Package, barra: "border-l-orange-500", chip: "bg-orange-100 text-orange-900", banner: "bg-orange-50 text-orange-900 border-orange-200" },
  compras_internet: { icono: ShoppingCart, barra: "border-l-pink-500", chip: "bg-pink-100 text-pink-900", banner: "bg-pink-50 text-pink-900 border-pink-200" },
  entrega_domicilio: { icono: Home, barra: "border-l-amber-500", chip: "bg-amber-100 text-amber-900", banner: "bg-amber-50 text-amber-900 border-amber-200" },
  gastos_origen: { icono: Anchor, barra: "border-l-teal-600", chip: "bg-teal-100 text-teal-900", banner: "bg-teal-50 text-teal-900 border-teal-200" },
  naviera: { icono: Anchor, barra: "border-l-indigo-600", chip: "bg-indigo-100 text-indigo-900", banner: "bg-indigo-50 text-indigo-900 border-indigo-200" },
  gastos_locales: { icono: Landmark, barra: "border-l-emerald-600", chip: "bg-emerald-100 text-emerald-900", banner: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  documentacion: { icono: FileText, barra: "border-l-violet-600", chip: "bg-violet-100 text-violet-900", banner: "bg-violet-50 text-violet-900 border-violet-200" },
  transporte_local: { icono: Truck, barra: "border-l-lime-600", chip: "bg-lime-100 text-lime-900", banner: "bg-lime-50 text-lime-900 border-lime-200" },
  seguridad: { icono: ShieldCheck, barra: "border-l-red-600", chip: "bg-red-100 text-red-900", banner: "bg-red-50 text-red-900 border-red-200" },
  ayudantes: { icono: Users, barra: "border-l-stone-500", chip: "bg-stone-100 text-stone-900", banner: "bg-stone-50 text-stone-900 border-stone-200" },
  almacenadora: { icono: Warehouse, barra: "border-l-yellow-600", chip: "bg-yellow-100 text-yellow-900", banner: "bg-yellow-50 text-yellow-900 border-yellow-200" },
};

export const ESTILO_POR_DEFECTO: EstiloServicio = { icono: FileText, barra: "border-l-slate-400", chip: "bg-slate-100 text-slate-900", banner: "bg-slate-50 text-slate-900 border-slate-200" };

export const estiloSeccion = (seccion: string): EstiloServicio => ESTILO_SECCION[seccion] ?? ESTILO_POR_DEFECTO;
