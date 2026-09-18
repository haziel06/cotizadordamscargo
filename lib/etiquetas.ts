import type { Categoria, Moneda, TipoMargen, Unidad } from "@/lib/calculo/tipos";
import type { Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];
type TipoProveedor = Database["public"]["Enums"]["tipo_proveedor"];

export const CATEGORIAS: { valor: Categoria; texto: string; moneda: Moneda }[] = [
  { valor: "internacional", texto: "Flete internacional", moneda: "USD" },
  { valor: "local", texto: "Gastos locales", moneda: "GTQ" },
  { valor: "naviera", texto: "Gastos de naviera", moneda: "USD" },
];
export const textoCategoria = (c: Categoria) => CATEGORIAS.find((x) => x.valor === c)?.texto ?? c;

export const UNIDADES: { valor: Unidad; texto: string }[] = [
  { valor: "envio", texto: "por envío" },
  { valor: "contenedor", texto: "por contenedor" },
  { valor: "kg", texto: "por kg" },
  { valor: "cbm", texto: "por CBM" },
  { valor: "libra", texto: "por libra" },
];
export const textoUnidad = (u: Unidad) => UNIDADES.find((x) => x.valor === u)?.texto ?? u;

export const TIPOS_MARGEN: { valor: TipoMargen; texto: string; corto: string }[] = [
  { valor: "porcentaje", texto: "Porcentaje sobre costo", corto: "% sobre costo" },
  { valor: "monto_fijo", texto: "Monto fijo por unidad", corto: "+ monto fijo" },
  { valor: "precio_fijo", texto: "Precio de venta fijo", corto: "= precio fijo" },
];

export const ESTADOS: { valor: Estado; texto: string; clase: string }[] = [
  { valor: "borrador", texto: "Borrador", clase: "bg-muted text-foreground" },
  { valor: "enviada", texto: "Enviada", clase: "bg-blue-100 text-blue-900" },
  { valor: "aceptada", texto: "Aceptada", clase: "bg-green-100 text-green-900" },
  { valor: "rechazada", texto: "Rechazada", clase: "bg-red-100 text-red-900" },
  { valor: "vencida", texto: "Vencida", clase: "bg-amber-100 text-amber-900" },
];
export const infoEstado = (e: Estado) => ESTADOS.find((x) => x.valor === e) ?? ESTADOS[0];

export const TIPOS_PROVEEDOR: { valor: TipoProveedor; texto: string }[] = [
  { valor: "naviera", texto: "Naviera" },
  { valor: "agente_origen", texto: "Agente en origen" },
  { valor: "transportista", texto: "Transportista" },
  { valor: "courier", texto: "Courier" },
  { valor: "almacenadora", texto: "Almacenadora" },
  { valor: "custodio", texto: "Custodio" },
  { valor: "otro", texto: "Otro" },
];

export const TIPOS_CARGA = ["FCL 20GP", "FCL 40GP", "FCL 40HC", "LCL", "Carga aérea", "Terrestre"];

/** Incoterms 2020. El texto corto es lo que ve el usuario en el selector. */
export const INCOTERMS: { valor: string; texto: string }[] = [
  { valor: "EXW", texto: "EXW · En fábrica" },
  { valor: "FCA", texto: "FCA · Franco transportista" },
  { valor: "FAS", texto: "FAS · Franco al costado del buque" },
  { valor: "FOB", texto: "FOB · Franco a bordo" },
  { valor: "CFR", texto: "CFR · Costo y flete" },
  { valor: "CIF", texto: "CIF · Costo, seguro y flete" },
  { valor: "CPT", texto: "CPT · Transporte pagado hasta" },
  { valor: "CIP", texto: "CIP · Transporte y seguro pagados hasta" },
  { valor: "DAP", texto: "DAP · Entregado en lugar" },
  { valor: "DPU", texto: "DPU · Entregado en lugar descargado" },
  { valor: "DDP", texto: "DDP · Entregado derechos pagados" },
];

export const AMBITOS_DESCUENTO: { valor: "internacional" | "local" | "naviera" | "total"; texto: string }[] = [
  { valor: "total", texto: "Total general" },
  { valor: "internacional", texto: "Flete internacional" },
  { valor: "local", texto: "Gastos locales" },
  { valor: "naviera", texto: "Gastos de naviera" },
];
