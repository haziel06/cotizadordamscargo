import type { Categoria, Moneda, TipoMargen, Unidad } from "@/lib/calculo/tipos";
import type { Database } from "@/lib/supabase/tipos";

type Estado = Database["public"]["Enums"]["estado_cotizacion"];
type TipoServicio = Database["public"]["Enums"]["tipo_servicio"];
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
  { valor: "pie_cubico", texto: "por pie cúbico" },
  { valor: "guia", texto: "por guía" },
  { valor: "factura", texto: "por factura" },
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

/**
 * Tipos de cotización (primer paso al crear una). Cada uno dice qué secciones de tarifas
 * aparecen y qué campos de carga importan.
 */
/**
 * Campos de la cabecera que muestra cada servicio. `comercial` = incoterm, tránsito, routing y tipo de carga
 * (carga comercial; un paquete personal de courier no los usa). `consignatario` = empresa que recibe, aparte del
 * contacto. `entrega` = dirección y perímetro (courier).
 */
export type CampoCarga = "contenedor" | "cbm" | "kg" | "kg_volumetricos" | "libras" | "bultos" | "medidas" | "valor_mercaderia" | "comercial" | "consignatario" | "entrega";
export interface DefServicio {
  valor: TipoServicio;
  /** Familia para agrupar las tarjetas al elegir: Marítimo, Aéreo, Local. */
  grupo: "Marítimo" | "Aéreo" | "Local";
  texto: string;
  descripcion: string;
  ejemplo: string;
  /** Secciones de la base de tarifas que se ofrecen, en orden. */
  secciones: string[];
  /** Campos de carga relevantes. */
  campos: CampoCarga[];
  tiposCarga: string[];
}
export const SERVICIOS: DefServicio[] = [
  {
    valor: "maritimo_fcl", grupo: "Marítimo", texto: "Marítimo FCL", descripcion: "Contenedor completo", ejemplo: "China → Guatemala, 1 × 40HC",
    secciones: ["flete_maritimo", "gastos_origen", "naviera", "gastos_locales", "documentacion", "transporte_local", "seguridad", "ayudantes"],
    campos: ["contenedor", "kg", "cbm", "bultos", "comercial", "consignatario"],
    tiposCarga: ["FCL 20GP", "FCL 40GP", "FCL 40HC", "FCL 45HC"],
  },
  {
    valor: "maritimo_lcl", grupo: "Marítimo", texto: "Marítimo LCL / consolidado", descripcion: "Carga suelta por CBM", ejemplo: "Xiamen → Guatemala, 6.05 CBM",
    secciones: ["flete_maritimo", "gastos_origen", "naviera", "gastos_locales", "documentacion", "transporte_local", "seguridad", "ayudantes", "entrega_domicilio"],
    campos: ["cbm", "kg", "bultos", "medidas", "comercial", "consignatario"],
    tiposCarga: ["Consolidado marítimo LCL"],
  },
  {
    valor: "aereo", grupo: "Aéreo", texto: "Carga aérea", descripcion: "Carga aérea por kg o libra", ejemplo: "Miami → Guatemala, 130 lb",
    secciones: ["flete_aereo", "gastos_origen", "gastos_locales", "documentacion", "transporte_local", "entrega_domicilio", "ayudantes"],
    campos: ["kg", "kg_volumetricos", "libras", "bultos", "medidas", "comercial", "consignatario"],
    tiposCarga: ["Carga aérea consolidada", "Carga aérea directa"],
  },
  {
    valor: "courier", grupo: "Aéreo", texto: "Courier", descripcion: "Ticket o consolidado, por libra", ejemplo: "Miami → Guatemala, 25 lb",
    secciones: ["courier", "documentacion", "entrega_domicilio", "gastos_ajenos", "gastos_locales"],
    campos: ["libras", "kg", "bultos", "valor_mercaderia", "entrega"],
    tiposCarga: ["Courier", "Carga express aérea"],
  },
  {
    valor: "terrestre", grupo: "Local", texto: "Transporte terrestre", descripcion: "Puerto o bodega → destino local", ejemplo: "Puerto Quetzal → zona 12",
    secciones: ["transporte_local", "seguridad", "ayudantes", "entrega_domicilio"],
    campos: ["contenedor", "kg", "bultos", "medidas", "comercial", "consignatario"],
    tiposCarga: ["Contenedor", "Carga suelta"],
  },
  {
    valor: "aduanas", grupo: "Local", texto: "Gestión aduanera", descripcion: "El cliente ya trae la carga", ejemplo: "Trámite, DUCA, TLC",
    secciones: ["documentacion", "almacenadora", "gastos_locales", "seguridad"],
    campos: ["contenedor", "kg", "cbm", "bultos", "comercial", "consignatario"],
    tiposCarga: ["FCL", "LCL", "Aéreo", "Courier"],
  },
];
export const infoServicio = (v: TipoServicio) => SERVICIOS.find((s) => s.valor === v) ?? SERVICIOS[0];

/**
 * Una cotización puede combinar varios servicios (ej. transporte terrestre + gestión aduanera).
 * Devuelve la unión: secciones en el orden de la base, campos y tipos de carga sin repetir.
 */
export function servicioCombinado(tipos: TipoServicio[]): DefServicio {
  const defs = tipos.map(infoServicio).filter((d, i, a) => a.indexOf(d) === i);
  if (defs.length <= 1) return defs[0] ?? SERVICIOS[0];
  const union = <T,>(xs: T[][]) => [...new Set(xs.flat())];
  const secs = new Set(defs.flatMap((d) => d.secciones));
  return {
    valor: defs[0].valor,
    grupo: defs[0].grupo,
    texto: defs.map((d) => d.texto).join(" + "),
    descripcion: defs.map((d) => d.descripcion).join(" · "),
    ejemplo: defs[0].ejemplo,
    secciones: SECCIONES.map((s) => s.valor).filter((v) => secs.has(v)),
    campos: union(defs.map((d) => d.campos)),
    tiposCarga: union(defs.map((d) => d.tiposCarga)),
  };
}

/** Courier se divide en tres segmentos; el trabajo fuerte está en ticket y consolidado. */
export const SEGMENTOS_COURIER: { valor: "ticket" | "consolidado" | "documentos"; texto: string; descripcion: string }[] = [
  { valor: "consolidado", texto: "Consolidado", descripcion: "Compras tipo Amazon, menos de $1,000. Solo se cobra la libra." },
  { valor: "ticket", texto: "Ticket", descripcion: "Supera $1,000 o requiere póliza: libra + trámite aduanero + entrega. Almacenaje va aparte." },
  { valor: "documentos", texto: "Documentos", descripcion: "Sobres y documentos sin valor comercial." },
];
export const LIMITE_TICKET_USD = 1000;
/** Abreviaturas para marcar a qué servicios aplica un concepto de la base de tarifas. */
export const SERVICIOS_CORTOS: { valor: TipoServicio; corto: string }[] = [
  { valor: "maritimo_fcl", corto: "FCL" }, { valor: "maritimo_lcl", corto: "LCL" }, { valor: "aereo", corto: "Aéreo" },
  { valor: "courier", corto: "Courier" }, { valor: "terrestre", corto: "Terr." }, { valor: "aduanas", corto: "Aduana" },
];
/** Un concepto sin servicios marcados aplica a todos. */
export const conceptoAplica = (servicios: TipoServicio[] | null | undefined, tipos: TipoServicio[]) =>
  !servicios || servicios.length === 0 || tipos.some((t) => servicios.includes(t));
/**
 * Notas por defecto de courier (paquetería). Las generales de Configuración son de carga marítima
 * ("no incluye entrega local", naviera, puerto…) y contradicen al courier.
 */
export const TEXTOS_COURIER = {
  notas: [
    "Precios en $ no incluyen IVA",
    "Tarifa por libra sobre **peso real**; el peso se confirma al recibir el paquete en Miami",
    "==Entrega a domicilio incluida dentro del perímetro capitalino==; fuera del perímetro se cobra transporte externo según destino",
    "Aplica para mercadería con valor menor a **$1,000**; facturas mayores pasan a póliza (Ticket: trámite aduanero + almacenaje aparte)",
    "No incluye impuestos de importación ni almacenaje: el cliente los paga directo (SAT / Combex-Im)",
    "Mercadería voluminosa o frágil se cotiza por separado",
    "Seguro opcional: 1.5% sobre el valor CIF",
    "No se transporta carga IMO, baterías sueltas, líquidos inflamables, armas ni réplicas de marca",
  ],
  cuenta_cliente: ["Impuestos de importación (SAT)", "Almacenaje en Combex-Im cuando aplique", "Permisos especiales o licencias"],
};
/** Textos por defecto según los servicios de la cotización. */
export function textosPorDefecto(tipos: TipoServicio[], generales: { notas: string[]; cuenta_cliente: string[] }) {
  return tipos.length === 1 && tipos[0] === "courier" ? TEXTOS_COURIER : generales;
}
/** Nota que va al PDF cuando la entrega de courier es fuera del perímetro capitalino. */
export const NOTA_FUERA_PERIMETRO = "La entrega es **fuera del perímetro capitalino**: se envía con expreso externo y el costo del transporte se cobra aparte según el destino.";

/** Secciones de la base de tarifas. `categoria` = bloque del PDF donde caen sus líneas. */
export const SECCIONES: { valor: string; texto: string; categoria: Categoria; moneda: Moneda; descripcion: string }[] = [
  { valor: "flete_maritimo", texto: "Flete marítimo", categoria: "internacional", moneda: "USD", descripcion: "FCL y LCL por proveedor y ruta" },
  { valor: "flete_aereo", texto: "Flete aéreo", categoria: "internacional", moneda: "USD", descripcion: "Por kg o libra, con mínimos" },
  { valor: "courier", texto: "Courier", categoria: "internacional", moneda: "USD", descripcion: "Paquetería por libra" },
  { valor: "gastos_origen", texto: "Gastos en origen", categoria: "internacional", moneda: "USD", descripcion: "Pickup, BL, documentación, terrestre en origen" },
  { valor: "naviera", texto: "Gastos de naviera / destino", categoria: "naviera", moneda: "USD", descripcion: "Cargos de la línea o del agente en destino" },
  { valor: "gastos_locales", texto: "Gastos locales", categoria: "local", moneda: "GTQ", descripcion: "Paquetes y gastos generales en Guatemala" },
  { valor: "documentacion", texto: "Documentación aduanera", categoria: "local", moneda: "GTQ", descripcion: "Trámite, DUCA, TLC, transmisión, rectificación" },
  { valor: "transporte_local", texto: "Transporte local", categoria: "local", moneda: "GTQ", descripcion: "Puerto → ciudad, entregas" },
  { valor: "seguridad", texto: "Seguridad", categoria: "local", moneda: "GTQ", descripcion: "Patrulla, custodio, marchamo" },
  { valor: "ayudantes", texto: "Ayudantes", categoria: "local", moneda: "GTQ", descripcion: "Diurno, nocturno, horas hábiles" },
  { valor: "entrega_domicilio", texto: "Entrega a domicilio", categoria: "local", moneda: "USD", descripcion: "Por rango de peso" },
  { valor: "almacenadora", texto: "Puerto / almacenadora", categoria: "local", moneda: "GTQ", descripcion: "Manejo, almacenaje y cargos de puerto o almacenadora" },
  { valor: "gastos_ajenos", texto: "Gastos por cuenta ajena", categoria: "local", moneda: "GTQ", descripcion: "Pagos a terceros (Combex, impuestos): salen aparte, sin margen" },
];
export const infoSeccion = (v: string) => SECCIONES.find((s) => s.valor === v) ?? { valor: v, texto: v, categoria: "local" as Categoria, moneda: "GTQ" as Moneda, descripcion: "" };
