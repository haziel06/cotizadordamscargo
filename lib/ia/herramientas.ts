import { listarCotizaciones, listarPerfiles } from "@/lib/cotizaciones/consultas";
import { calcularMetricas, type FilaMetrica } from "@/lib/cotizaciones/metricas";
import { catalogoParaCotizar, listarTarifarios } from "@/lib/tarifas/consultas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerConfig } from "@/lib/config";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import type { ContextoHerramienta, HerramientaIA } from "./tipos";

/** Nunca deja salir costo/utilidad/margen a quien no sea admin: mismo criterio que el resto de la app. */
function cotizacionParaVista(c: Awaited<ReturnType<typeof listarCotizaciones>>[number], esAdmin: boolean) {
  const base = {
    numero: c.numero,
    cliente: c.cliente_nombre,
    fecha: formatoFecha(c.fecha),
    estado: c.estado_efectivo,
    servicio: c.tipos_servicio?.[0] ?? c.tipo_servicio,
    total: formatoMoneda(c.total_gtq, "GTQ"),
  };
  return esAdmin ? { ...base, utilidad: formatoMoneda(c.utilidad_gtq, "GTQ"), margen_pct: c.margen_pct } : base;
}

const buscarCotizaciones: HerramientaIA = {
  nombre: "buscarCotizaciones",
  descripcion: "Busca cotizaciones por nombre de cliente y/o estado. Devuelve las más recientes primero.",
  parametros: {
    type: "object",
    properties: {
      cliente: { type: "string", description: "Nombre o parte del nombre del cliente" },
      estado: { type: "string", enum: ["borrador", "enviada", "aceptada", "rechazada", "vencida"] },
      limite: { type: "number", description: "Máximo de resultados, por defecto 10" },
    },
  },
  async ejecutar(args, { sesion }: ContextoHerramienta) {
    const limite = Math.min(Number(args.limite) || 10, 30);
    const filas = await listarCotizaciones({
      q: typeof args.cliente === "string" ? args.cliente : undefined,
      estado: typeof args.estado === "string" ? args.estado : undefined,
      usuario: sesion.esAdmin ? undefined : sesion.userId,
      limite,
    });
    return { resultados: filas.slice(0, limite).map((c) => cotizacionParaVista(c, sesion.esAdmin)) };
  },
};

const obtenerUltimaCotizacion: HerramientaIA = {
  nombre: "obtenerUltimaCotizacion",
  descripcion: "Obtiene la cotización más reciente de un cliente específico.",
  parametros: {
    type: "object",
    properties: { cliente: { type: "string", description: "Nombre del cliente" } },
    required: ["cliente"],
  },
  async ejecutar(args, { sesion }: ContextoHerramienta) {
    const filas = await listarCotizaciones({
      q: String(args.cliente ?? ""),
      usuario: sesion.esAdmin ? undefined : sesion.userId,
      limite: 1,
    });
    if (!filas.length) return { encontrado: false };
    return { encontrado: true, cotizacion: cotizacionParaVista(filas[0], sesion.esAdmin) };
  },
};

const resumenMetricas: HerramientaIA = {
  nombre: "resumenMetricas",
  descripcion: "Resumen de actividad: cuántas cotizaciones hay por estado, del mes en curso, y tasa de aceptación.",
  parametros: { type: "object", properties: {} },
  async ejecutar(_args, { sesion }: ContextoHerramienta) {
    const filas = await listarCotizaciones({ usuario: sesion.esAdmin ? undefined : sesion.userId, limite: 500 });
    const m = calcularMetricas(filas as unknown as FilaMetrica[]);
    const base = {
      total_cotizaciones: m.total,
      por_estado: m.porEstado,
      mes_actual: { cotizadas: m.mes.cotizadas, monto: formatoMoneda(m.mes.monto_gtq, "GTQ"), aceptadas: m.mes.aceptadas },
      tasa_aceptacion_pct: m.tasa_aceptacion,
    };
    return sesion.esAdmin ? { ...base, utilidad_mes: formatoMoneda(m.mes.utilidad_gtq, "GTQ"), top_clientes: m.topClientes } : base;
  },
};

const buscarTarifas: HerramientaIA = {
  nombre: "buscarTarifas",
  descripcion: "Busca conceptos/servicios de tarifas por nombre (ej. 'flete aéreo', 'ayudante', 'trámite aduanal'). El campo \"precio_venta\" es SIEMPRE el precio final ya calculado (por 1 unidad, antes de aplicar el mínimo del proveedor si aplica); nunca uses \"valor_margen\" como si fuera el margen o el precio: su significado cambia según \"tipo_margen\".",
  parametros: {
    type: "object",
    properties: { q: { type: "string", description: "Texto a buscar en el nombre del concepto" } },
    required: ["q"],
  },
  async ejecutar(args, { sesion }: ContextoHerramienta) {
    const texto = String(args.q ?? "").toLowerCase();
    const [{ conceptos }, { recargos }] = await Promise.all([catalogoParaCotizar(), leerConfig()]);
    const coincidencias = conceptos.filter((c) => c.nombre.toLowerCase().includes(texto)).slice(0, 10);
    return {
      resultados: coincidencias.map((c) => {
        // El precio de venta SIEMPRE se calcula con el motor de cálculo (para 1 unidad, sin
        // mínimo del proveedor): nunca se le muestra al modelo el "valor_margen" crudo, porque
        // en conceptos "precio_fijo" ese número YA es el precio final, no un margen aparte.
        const precio_venta = ventaLinea(
          { nombre: c.nombre, categoria: c.categoria, moneda: c.moneda, cantidad: 1, costo_unitario: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos },
          recargos,
        );
        return {
          nombre: c.nombre,
          seccion: c.seccion,
          moneda: c.moneda,
          unidad: c.unidad,
          precio_venta,
          ...(sesion.esAdmin ? { costo: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), minimo: c.minimo } : {}),
        };
      }),
    };
  },
};

const buscarProveedor: HerramientaIA = {
  nombre: "buscarProveedor",
  descripcion: "Busca proveedores registrados por nombre.",
  parametros: {
    type: "object",
    properties: { q: { type: "string", description: "Texto a buscar en el nombre del proveedor" } },
    required: ["q"],
  },
  async ejecutar(args) {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.from("proveedores").select("nombre, tipo, pais, activo").ilike("nombre", `%${String(args.q ?? "")}%`).limit(10);
    return { resultados: data ?? [] };
  },
};

const buscarTarifarios: HerramientaIA = {
  nombre: "buscarTarifarios",
  descripcion: "Lista los tarifarios (hojas de tarifas por proveedor/servicio) disponibles, con su vigencia.",
  parametros: {
    type: "object",
    properties: { servicio: { type: "string", description: "Filtra por texto en nombre/sección, opcional" } },
  },
  async ejecutar(args) {
    const texto = typeof args.servicio === "string" ? args.servicio.toLowerCase() : "";
    const tarifarios = await listarTarifarios();
    const filtrados = texto ? tarifarios.filter((t) => t.nombre.toLowerCase().includes(texto) || t.seccion.toLowerCase().includes(texto)) : tarifarios;
    return {
      resultados: filtrados.slice(0, 15).map((t) => ({
        nombre: t.nombre, proveedor: t.proveedor_nombre, seccion: t.seccion, vigencia: t.vigencia,
      })),
    };
  },
};

const cotizacionesPorUsuario: HerramientaIA = {
  nombre: "cotizacionesPorUsuario",
  descripcion: "Solo para administradores: cuántas cotizaciones lleva OTRO empleado del equipo, por nombre. Usa 'hoy' o 'este_mes' para acotar el periodo.",
  parametros: {
    type: "object",
    properties: {
      usuario: { type: "string", description: "Nombre (o parte del nombre) del empleado" },
      periodo: { type: "string", enum: ["hoy", "este_mes", "todo"], description: "Por defecto 'todo'" },
    },
    required: ["usuario"],
  },
  async ejecutar(args) {
    const nombreBuscado = String(args.usuario ?? "").toLowerCase();
    const perfiles = await listarPerfiles();
    const perfil = perfiles.find((p) => (p.nombre || "").toLowerCase().includes(nombreBuscado));
    if (!perfil) return { encontrado: false, motivo: "No encontré a ningún usuario del equipo con ese nombre." };

    const filas = await listarCotizaciones({ usuario: perfil.user_id, limite: 500 });
    const hoy = new Date().toISOString().slice(0, 10);
    const mesActual = hoy.slice(0, 7);
    const filtradas = args.periodo === "hoy" ? filas.filter((f) => f.fecha === hoy)
      : args.periodo === "este_mes" ? filas.filter((f) => f.fecha.startsWith(mesActual))
      : filas;
    const m = calcularMetricas(filtradas as unknown as FilaMetrica[]);
    return {
      encontrado: true,
      usuario: perfil.nombre,
      periodo: args.periodo ?? "todo",
      total_cotizaciones: filtradas.length,
      por_estado: m.porEstado,
      monto_total: formatoMoneda(filtradas.reduce((s, f) => s + f.total_gtq, 0), "GTQ"),
    };
  },
};

/** Herramientas disponibles según el rol: la de otros usuarios solo se le ofrece a un administrador. */
export function herramientasDisponibles(esAdmin: boolean): HerramientaIA[] {
  const base = [buscarCotizaciones, obtenerUltimaCotizacion, resumenMetricas, buscarTarifas, buscarProveedor, buscarTarifarios];
  return esAdmin ? [...base, cotizacionesPorUsuario] : base;
}
