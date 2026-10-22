import { crearClienteServidor } from "@/lib/supabase/server";
import { leerConfig } from "@/lib/config";
import { sesionActual, type Sesion } from "@/lib/sesion";
import { catalogoParaCotizar } from "@/lib/tarifas/consultas";
import { tarifasEspecialesCliente } from "@/lib/clientes/consultas";
import { guardarCotizacion } from "@/lib/cotizaciones/acciones";
import { cantidadPorUnidad, conceptosCourier } from "@/lib/cotizaciones/armado";
import type { LineaEditable } from "@/lib/cotizaciones/esquema";
import { conceptoAplica, LIMITE_TICKET_USD } from "@/lib/etiquetas";
import { pesoCobrable } from "@/lib/calculo/peso";
import { formatoMoneda, hoyIso } from "@/lib/calculo/formato";
import type { Concepto, SegmentoCourier, TipoServicio } from "@/lib/supabase/tipos";
import type { AdjuntoChat } from "./tipos";

export interface DatosCotizacionChat {
  cliente?: string;
  servicio?: string;
  segmento_courier?: string;
  kilogramos?: number;
  bultos?: number;
  medidas?: string;
  mercaderia?: string;
  valor_mercaderia?: number;
  origen?: string;
  destino?: string;
  contacto?: string;
  telefono?: string;
  fuera_perimetro?: boolean;
  notas_internas?: string;
  conceptos_adicionales?: string[];
}

const SERVICIOS: TipoServicio[] = ["courier", "aereo", "maritimo_lcl", "maritimo_fcl", "terrestre", "aduanas"];
const SEGMENTOS: SegmentoCourier[] = ["ticket", "consolidado", "documentos", "compras_internet"];

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export type ResultadoCotizacionChat =
  | { ok: true; resumen: Record<string, unknown>; adjunto: AdjuntoChat }
  | { ok: false; faltan?: string[]; error?: string };

/**
 * Arma y guarda (como borrador) una cotización a partir de lo que el empleado le contó al chat.
 * La IA solo aporta los datos; precios, márgenes, tarifas especiales y totales los pone el mismo
 * sistema de siempre (`guardarCotizacion`), y para un usuario normal reconstruye cada línea desde la
 * base, así que nada de lo que "diga" el modelo puede inventar o filtrar un costo.
 */
export async function crearCotizacionDesdeChat(datos: DatosCotizacionChat, sesion: Sesion): Promise<ResultadoCotizacionChat> {
  if (!(await sesionActual())) return { ok: false, error: "Sesión vencida." };

  const cliente = texto(datos.cliente);
  const servicio = SERVICIOS.find((s) => s === datos.servicio);
  const faltan: string[] = [];
  if (!cliente) faltan.push("nombre del cliente");
  if (!servicio) faltan.push(`servicio (${SERVICIOS.join(", ")})`);
  const kg = num(datos.kilogramos);
  const valorMerc = num(datos.valor_mercaderia);
  let segmento: SegmentoCourier | null = null;
  if (servicio === "courier") {
    if (!kg) faltan.push("peso en kilogramos");
    segmento = SEGMENTOS.find((s) => s === datos.segmento_courier) ?? (valorMerc ? (valorMerc > LIMITE_TICKET_USD ? "ticket" : "consolidado") : null);
    if (!segmento) faltan.push("tipo de courier (ticket o consolidado) o el valor de la mercadería para decidirlo");
  }
  if (faltan.length || !cliente || !servicio) return { ok: false, faltan };

  const supabase = await crearClienteServidor();
  const [{ recargos, defaults }, clienteRegistrado] = await Promise.all([leerConfig(), buscarClienteRegistrado(supabase, cliente)]);
  const catalogo = await catalogoParaCotizar({ ocultarCostos: !sesion.esAdmin, recargos });
  const tarifasCliente = await tarifasEspecialesCliente(clienteRegistrado?.id ?? null, { ocultarCostos: !sesion.esAdmin });

  const peso = pesoCobrable(kg, null).peso;
  const aplicables = catalogo.conceptos.filter((c) => conceptoAplica(c.servicios, [servicio]));
  const elegidos: Concepto[] = segmento
    ? conceptosCourier(aplicables, { segmento, pesoCobrable: peso, fueraPerimetro: datos.fuera_perimetro, yaMarcados: new Set() })
    : [];

  const advertencias: string[] = [];
  const noEncontrados: string[] = [];
  for (const pedido of (datos.conceptos_adicionales ?? []).slice(0, 12)) {
    const buscado = normalizar(String(pedido));
    if (!buscado) continue;
    const candidatos = aplicables.filter((c) => normalizar(c.nombre).includes(buscado));
    const c = candidatos.find((x) => normalizar(x.nombre) === buscado) ?? candidatos[0];
    if (!c) noEncontrados.push(String(pedido));
    else if (!elegidos.some((e) => e.id === c.id)) elegidos.push(c);
  }
  if (noEncontrados.length) advertencias.push(`No encontré en la base de tarifas: ${noEncontrados.join(", ")}.`);
  if (!elegidos.length) advertencias.push("La cotización quedó sin líneas de servicio: hay que agregarlas desde el editor.");

  const provNombre = new Map(catalogo.proveedores.map((p) => [p.id, p.nombre]));
  const tarifarioPorId = new Map(catalogo.tarifarios.map((t) => [t.id, t]));
  const aplicadasEspeciales: string[] = [];
  const lineas = elegidos.map((c): Omit<LineaEditable, "_clave"> => {
    const t = c.tarifario_id ? tarifarioPorId.get(c.tarifario_id) : undefined;
    const especial = tarifasCliente.get(c.id);
    if (especial) aplicadasEspeciales.push(c.nombre);
    return {
      concepto_id: c.id, ruta_id: null, nombre: c.nombre, categoria: c.categoria, moneda: c.moneda,
      cantidad: cantidadPorUnidad(c.unidad, peso, 0), costo_unitario: Number(c.costo),
      tipo_margen: especial?.tipo_margen ?? c.tipo_margen, valor_margen: especial ? especial.valor_margen : Number(c.valor_margen),
      lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos, cuenta_ajena: c.cuenta_ajena, nota: null, nota_visible: true,
      proveedor_nombre: c.proveedor_id ? (provNombre.get(c.proveedor_id) ?? null) : null,
      ruta: t?.origen && t?.destino && t.seccion !== "gastos_locales" ? `${t.origen} → ${t.destino}` : null,
    };
  });

  const guardado = await guardarCotizacion({
    id: null,
    cabecera: {
      tipo_servicio: servicio, tipos_servicio: [servicio],
      cliente_id: clienteRegistrado?.id ?? null,
      cliente_nombre: clienteRegistrado ? (clienteRegistrado.empresa || clienteRegistrado.nombre) : cliente,
      contacto: texto(datos.contacto), cliente_telefono: texto(datos.telefono),
      fuera_perimetro: Boolean(datos.fuera_perimetro), segmento_courier: segmento,
      valor_mercaderia: valorMerc, fecha: hoyIso(), dias_vigencia: defaults.dias_vigencia,
      kilogramos: kg, bultos: num(datos.bultos), medidas: texto(datos.medidas), mercaderia: texto(datos.mercaderia),
      origen: texto(datos.origen), destino: texto(datos.destino) ?? "Guatemala",
      tipo_cambio: defaults.tipo_cambio,
      tipo_carga: null, kg_volumetricos: null, cbm: null, transito: null, routing: null, incoterm: null,
      notas_internas: [texto(datos.notas_internas), "Creada con el asistente de IA"].filter(Boolean).join(" · "),
    },
    lineas,
  });
  if (!guardado.ok) return { ok: false, error: guardado.error };

  const [{ data: cab }, { data: filas }] = await Promise.all([
    supabase.from("cotizaciones").select("numero, cliente_nombre, total_gtq").eq("id", guardado.id).single(),
    supabase.from("cotizacion_lineas").select("nombre, cantidad, moneda, venta_total").eq("cotizacion_id", guardado.id).order("orden"),
  ]);
  if (!cab) return { ok: false, error: "Se guardó pero no pude leer el resultado." };

  const total = formatoMoneda(Number(cab.total_gtq), "GTQ");
  if (!clienteRegistrado) advertencias.push("El cliente no está guardado en el sistema: no se aplicaron tarifas especiales.");
  return {
    ok: true,
    adjunto: { tipo: "cotizacion", id: guardado.id, numero: cab.numero, cliente: cab.cliente_nombre, total },
    resumen: {
      numero: cab.numero, cliente: cab.cliente_nombre, total_gtq: total, estado: "borrador",
      lineas: (filas ?? []).map((l) => ({ servicio: l.nombre, cantidad: l.cantidad, venta: formatoMoneda(Number(l.venta_total), l.moneda) })),
      tarifas_especiales_aplicadas: aplicadasEspeciales,
      advertencias,
    },
  };
}

async function buscarClienteRegistrado(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, nombre: string) {
  const patron = nombre.replace(/[^\p{L}\p{N} .&-]/gu, "").trim();
  if (patron.length < 3) return null;
  const { data } = await supabase.from("clientes").select("id, nombre, empresa").eq("activo", true).or(`nombre.ilike.%${patron}%,empresa.ilike.%${patron}%`).limit(2);
  // Solo si es inequívoco: con dos coincidencias es preferible no atar la cotización al cliente equivocado.
  return data?.length === 1 ? data[0] : null;
}
