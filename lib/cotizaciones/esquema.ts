import { z } from "zod";

/** Número opcional: "" o null → null. */
const numOpcional = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : Number(v)),
  z.number().min(0).nullable(),
);
const textoOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().nullable());

export const esquemaLinea = z.object({
  concepto_id: z.string().uuid().nullable(),
  nombre: z.string().trim().min(1, "Cada línea necesita un nombre"),
  categoria: z.enum(["internacional", "local", "naviera"]),
  moneda: z.enum(["USD", "GTQ"]),
  cantidad: z.coerce.number().min(0),
  costo_unitario: z.coerce.number().min(0),
  tipo_margen: z.enum(["porcentaje", "monto_fijo", "precio_fijo"]),
  valor_margen: z.coerce.number().min(0),
  lleva_iva: z.boolean(),
  aplica_recargos: z.boolean().default(false),
  nota: textoOpcional.default(null),
  nota_visible: z.boolean().default(true),
  proveedor_nombre: textoOpcional.default(null),
  ruta: textoOpcional.default(null),
  cuenta_ajena: z.boolean().default(false),
  ruta_id: z.string().uuid().nullable().default(null),
});
export type LineaEditable = z.infer<typeof esquemaLinea> & {
  _clave: string;
  /** Unidad del concepto de origen, para la cantidad automática. */
  unidad?: string;
  /** Marcado si el concepto venía con "falta monto". */
  pendiente?: boolean;
  /** Sección de la base de tarifas donde se muestra en el editor. */
  seccion?: string;
  /** true cuando alguien escribió la cantidad a mano: deja de seguir al peso/volumen de la carga. */
  cantidad_manual?: boolean;
  /** Mínimo facturable del proveedor (ya en términos de venta si el usuario no ve costo). No se guarda: se recalcula desde el concepto. */
  minimo?: number | null;
  /** El concepto permite que cualquier usuario (no solo admin) ajuste el precio de venta final. */
  editable_por_todos?: boolean;
  /** Esta línea usa una tarifa especial guardada para el cliente de la cotización (solo aviso visual). */
  esTarifaCliente?: boolean;
};

export const esquemaDescuento = z.object({
  ambito: z.enum(["internacional", "local", "naviera", "total"]),
  tipo: z.enum(["porcentaje", "monto"]),
  valor: z.coerce.number().min(0),
  moneda: z.enum(["USD", "GTQ"]).optional(),
});
export type DescuentoForm = z.infer<typeof esquemaDescuento> & { _clave: string };

export const esquemaNotas = z.object({
  notas: z.array(z.string()),
  cuenta_cliente: z.array(z.string()),
});

const tipoServicio = z.enum(["maritimo_fcl", "maritimo_lcl", "aereo", "courier", "terrestre", "aduanas"]);
export const esquemaCabecera = z.object({
  tipo_servicio: tipoServicio.default("maritimo_fcl"),
  /** Una cotización puede combinar varios servicios; el primero es el principal. */
  tipos_servicio: z.array(tipoServicio).min(1, "Elige al menos un servicio"),
  cliente_id: z.string().uuid().nullable(),
  /** Empresa: es lo que sale como "Cliente" en el PDF. */
  cliente_nombre: z.string().trim().min(1, "Escribe el nombre de la empresa o cliente"),
  contacto: textoOpcional,
  cliente_telefono: textoOpcional,
  /** Empresa que recibe la carga (LCL/FCL) o empresa del cliente en courier. Opcional. */
  consignatario: textoOpcional.default(null),
  direccion_entrega: textoOpcional.default(null),
  fuera_perimetro: z.boolean().default(false),
  segmento_courier: z.enum(["ticket", "consolidado", "documentos", "compras_internet"]).nullable().default(null),
  valor_mercaderia: numOpcional,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  dias_vigencia: z.coerce.number().int().min(1).max(365),
  tipo_carga: textoOpcional,
  kilogramos: numOpcional,
  kg_volumetricos: numOpcional,
  cbm: numOpcional,
  bultos: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(0).nullable()),
  medidas: textoOpcional,
  mercaderia: textoOpcional,
  origen: textoOpcional,
  destino: z.string().trim().min(1).default("Guatemala"),
  transito: textoOpcional,
  routing: textoOpcional,
  tipo_cambio: z.coerce.number().positive("El tipo de cambio debe ser mayor que 0"),
  notas_internas: textoOpcional,
  incoterm: textoOpcional,
  descuentos: z.array(esquemaDescuento).default([]),
  /** null = usar las notas de Configuración. */
  notas: esquemaNotas.nullable().default(null),
});
export type Cabecera = z.infer<typeof esquemaCabecera>;
/** Lo que maneja el formulario: campos numéricos como string o number, vacíos permitidos. */
export interface CabeceraForm {
  tipo_servicio: "maritimo_fcl" | "maritimo_lcl" | "aereo" | "courier" | "terrestre" | "aduanas";
  tipos_servicio: ("maritimo_fcl" | "maritimo_lcl" | "aereo" | "courier" | "terrestre" | "aduanas")[];
  cliente_id: string | null;
  cliente_nombre: string;
  contacto: string;
  cliente_telefono: string;
  consignatario: string;
  direccion_entrega: string;
  fuera_perimetro: boolean;
  segmento_courier: "ticket" | "consolidado" | "documentos" | "compras_internet" | null;
  valor_mercaderia: number | string;
  fecha: string;
  dias_vigencia: number | string;
  tipo_carga: string;
  kilogramos: number | string;
  kg_volumetricos: number | string;
  cbm: number | string;
  bultos: number | string;
  medidas: string;
  mercaderia: string;
  origen: string;
  destino: string;
  transito: string;
  routing: string;
  tipo_cambio: number | string;
  notas_internas: string;
  incoterm: string;
  descuentos: DescuentoForm[];
  notas: { notas: string[]; cuenta_cliente: string[] } | null;
}

export const esquemaGuardar = z.object({
  id: z.string().uuid().nullable(),
  cabecera: esquemaCabecera,
  lineas: z.array(esquemaLinea),
});
