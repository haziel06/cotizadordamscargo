import { listarCotizaciones, listarPerfiles } from "@/lib/cotizaciones/consultas";
import { calcularMetricas, type FilaMetrica } from "@/lib/cotizaciones/metricas";
import { catalogoParaCotizar, listarTarifarios } from "@/lib/tarifas/consultas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerConfig } from "@/lib/config";
import { ventaLinea } from "@/lib/calculo/linea";
import { formatoFecha, formatoMoneda } from "@/lib/calculo/formato";
import { ETIQUETA_ESTADO } from "@/lib/tarifas/estado";
import { cotizacionesDeCliente, listarClientes, obtenerCliente } from "@/lib/clientes/consultas";
import { clientesSimilares } from "@/lib/clientes/buscar";
import { buscarFletes, normalizar, palabras, rutaCoincideOrigen, textoTransito, textoVia, ventaRuta } from "@/lib/cotizaciones/fletes";
import { textoUnidad } from "@/lib/etiquetas";
import { coincideProveedor, extraerTarifarioDeDocumento } from "./tarifarioIA";
import { proponerActualizacion } from "@/lib/tarifas/actualizacion";
import { resumenCambios } from "@/lib/tarifas/diferencias";
import { crearCotizacionDesdeChat, type DatosCotizacionChat } from "./crearCotizacionChat";
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
          ...(sesion.esAdmin ? { precio_compra_proveedor: Number(c.costo), tipo_margen: c.tipo_margen, valor_margen: Number(c.valor_margen), minimo: c.minimo, ganancia_por_unidad: Math.round((precio_venta - Number(c.costo)) * 100) / 100 } : {}),
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
        nombre: t.nombre, proveedor: t.proveedor_nombre, seccion: t.seccion, estado: ETIQUETA_ESTADO[t.estado].texto, vigente_hasta: t.vigencia_hasta,
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

const buscarFletesHerramienta: HerramientaIA = {
  nombre: "buscarFletes",
  descripcion: "Busca los fletes (marítimo o aéreo) desde un origen en TODOS los tarifarios vigentes, ya con el precio de venta, del más barato al más caro. Úsala ANTES de crear una cotización de contenedor, LCL o aéreo: en el chat aparece solo una tarjeta con las opciones para que el empleado elija con un clic. Cada opción trae un 'ref' que luego pasas a crearCotizacion.",
  parametros: {
    type: "object",
    properties: {
      origen: { type: "string", description: "Puerto o ciudad de origen, ej. 'Shanghai' o 'Xiamen, China'" },
      servicio: { type: "string", enum: ["maritimo_fcl", "maritimo_lcl", "aereo"], description: "Tipo de flete" },
      tipo_contenedor: { type: "string", description: "Solo FCL: 20GP, 40GP o 40HC" },
    },
    required: ["origen", "servicio"],
  },
  async ejecutar(args, { sesion, adjuntos }: ContextoHerramienta) {
    const { recargos } = await leerConfig();
    const catalogo = await catalogoParaCotizar({ ocultarCostos: !sesion.esAdmin, recargos });
    const servicio = String(args.servicio ?? "");
    const tarifarios = catalogo.tarifarios.filter((t) => !t.servicio || t.servicio === servicio);
    const tipoCarga = servicio === "maritimo_fcl" && args.tipo_contenedor ? `FCL ${args.tipo_contenedor}` : null;
    const opciones = buscarFletes({ rutas: catalogo.rutas, tarifarios, origen: String(args.origen ?? ""), tipoCarga, recargos, limite: 8 });
    if (!opciones.length) {
      const disponibles = [...new Set(catalogo.rutas.filter((r) => tarifarios.some((t) => t.id === r.tarifario_id)).map((r) => r.origen))].slice(0, 20);
      // ¿Existen tarifas para ese origen pero en un tarifario vencido o que aún no empieza? Es lo más útil de saber.
      const fuera = catalogo.noDisponibles.filter((t) => (!t.servicio || t.servicio === servicio) && (t.estado === "vencido" || t.estado === "programado"));
      const { data: ocultas } = fuera.length
        ? await (await crearClienteServidor()).from("tarifas_ruta").select("origen, pais, via, tarifario_id").in("tarifario_id", fuera.map((t) => t.id)).is("archivado_at", null)
        : { data: [] };
      const pals = palabras(String(args.origen ?? ""));
      const conTarifa = new Set((ocultas ?? []).filter((r) => rutaCoincideOrigen(r, pals)).map((r) => r.tarifario_id));
      const noVigentes = fuera.filter((t) => conTarifa.has(t.id)).map((t) => ({ tarifario: t.nombre, estado: ETIQUETA_ESTADO[t.estado].texto, vigente_desde: t.vigencia_desde, vigente_hasta: t.vigencia_hasta }));
      return {
        encontrados: 0, mensaje: "No hay fletes vigentes hoy para ese origen en ese servicio.", origenes_disponibles: disponibles,
        existen_pero_no_vigentes: noVigentes,
        instruccion: noVigentes.length
          ? "Dile que SÍ hay tarifas para ese origen pero en un tarifario vencido o que aún no empieza (menciona cuál y sus fechas) y que el administrador puede renovarlo en Base de tarifas."
          : "Díselo al empleado y ofrécele estos orígenes o que revise el nombre del puerto.",
      };
    }
    const detalle = (o: (typeof opciones)[number]) =>
      [o.tarifario.nombre, o.ruta.naviera, o.ruta.variante, textoVia(o.ruta.via), o.ruta.transito ? textoTransito(o.ruta.transito) : null].filter(Boolean).join(" · ");
    const precio = (o: (typeof opciones)[number]) => `${formatoMoneda(o.venta, o.tarifario.moneda)} / ${textoUnidad(o.ruta.unidad).replace("por ", "")}`;
    adjuntos.push({
      tipo: "opciones_flete",
      titulo: `Fletes desde ${args.origen}${tipoCarga ? ` · ${tipoCarga}` : ""}`,
      opciones: opciones.map((o) => ({ ref: o.ruta.id.slice(0, 8), etiqueta: `${o.ruta.origen}${o.ruta.pais ? `, ${o.ruta.pais}` : ""}`, detalle: detalle(o), precio: precio(o) })),
    });
    return {
      encontrados: opciones.length,
      opciones: opciones.map((o, i) => ({
        n: i + 1, ref: o.ruta.id.slice(0, 8), tarifario: o.tarifario.nombre, naviera: o.ruta.naviera, origen: o.ruta.origen, pais: o.ruta.pais, variante: o.ruta.variante,
        via: textoVia(o.ruta.via), transito: o.ruta.transito ? textoTransito(o.ruta.transito) : null, precio_venta: precio(o),
        vigente_hasta: catalogo.tarifarios.find((t) => t.id === o.ruta.tarifario_id)?.vigencia_hasta ?? null,
        ...(sesion.esAdmin ? { precio_compra_proveedor: o.ruta.costo, margen_actual: `${o.ruta.tipo_margen === "porcentaje" ? `${o.ruta.valor_margen}%` : o.ruta.tipo_margen === "monto_fijo" ? `+${o.ruta.valor_margen} fijo` : `precio fijo ${o.ruta.valor_margen}`}`, ganancia_por_unidad: Math.round((o.venta - Number(o.ruta.costo ?? 0)) * 100) / 100 } : {}),
      })),
      instruccion: "Resume las opciones en una frase y pregunta cuál elige (las tarjetas con botones ya aparecen debajo). No crees la cotización hasta que elija.",
    };
  },
};

const buscarClientes: HerramientaIA = {
  nombre: "buscarClientes",
  descripcion: "Busca un cliente guardado por nombre y dice si tiene tarifas o precios especiales guardados y cuáles fueron sus últimas cotizaciones. Úsala al empezar una cotización para saber si el cliente ya existe y si tiene precio preferencial.",
  parametros: { type: "object", properties: { q: { type: "string", description: "Nombre o parte del nombre del cliente" } }, required: ["q"] },
  async ejecutar(args, { sesion }: ContextoHerramienta) {
    const q = String(args.q ?? "").trim().toLowerCase();
    if (q.length < 2) return { encontrados: 0 };
    // Tolera errores de escritura: "Cemaco" encuentra al cliente guardado como "camaco".
    const clientes = clientesSimilares(q, await listarClientes()).slice(0, 3);
    const usuario = sesion.esAdmin ? undefined : sesion.userId;
    // Cotizaciones hechas con ese nombre aunque nunca se vincularon a un cliente guardado.
    const porNombre = await listarCotizaciones({ q: String(args.q), usuario, limite: 5 });
    if (!clientes.length) {
      return { encontrados: 0, mensaje: "No hay ningún cliente guardado con ese nombre.", cotizaciones_con_ese_nombre: porNombre.map((x) => cotizacionParaVista(x, sesion.esAdmin)), instruccion: "Si hay cotizaciones con ese nombre, coméntalo. Para guardarlo como cliente el empleado puede usar «Guardar como cliente» al cotizar." };
    }
    const resultados = await Promise.all(clientes.map(async (c) => {
      const detalle = await obtenerCliente(c.id);
      const vinculadas = await cotizacionesDeCliente(c.id, { usuario, limite: 5 });
      const ultimas = await listarCotizaciones({ q: c.empresa || c.nombre, usuario, limite: 3 });
      const vistas = new Map<string, Record<string, unknown>>([...ultimas.map((x) => [x.numero, cotizacionParaVista(x, sesion.esAdmin)] as const), ...porNombre.map((x) => [x.numero, cotizacionParaVista(x, sesion.esAdmin)] as const)]);
      for (const v of vinculadas) if (!vistas.has(v.numero)) vistas.set(v.numero, { numero: v.numero, cliente: c.empresa || c.nombre, fecha: v.fecha, estado: v.estado, servicio: v.tipo_servicio, total: String(v.total_gtq) });
      return {
        nombre_registrado: c.empresa || c.nombre, contacto: c.contacto_nombre, telefono: c.contacto_telefono,
        // Solo qué servicios tienen precio especial: la fórmula o el margen detrás es del administrador.
        precios_especiales: (detalle?.tarifas ?? []).map((t) => (sesion.esAdmin ? `${t.concepto_nombre} (${t.tipo_margen} ${t.valor_margen})` : t.concepto_nombre)),
        ultimas_cotizaciones: [...vistas.values()].slice(0, 5),
      };
    }));
    return { encontrados: resultados.length, resultados, instruccion: "Usa el nombre_registrado; si el empleado lo escribió distinto, aclara cómo está guardado." };
  },
};

const crearCotizacion: HerramientaIA = {
  nombre: "crearCotizacion",
  descripcion: "Crea una cotización (queda como borrador) y deja listos los botones para descargar el PDF y abrirla en el editor. Solo úsala cuando el empleado pida crear/hacer/armar una cotización y YA tengas todo lo necesario y las elecciones confirmadas; si falta algo, NO la llames: pregúntaselo. Para contenedor, LCL o aéreo exige el flete elegido ('ruta_ref' de buscarFletes). Los precios los calcula el sistema con la base de tarifas (y las tarifas especiales del cliente si está guardado): tú nunca pasas ni inventas precios. Para courier, arma sola las líneas (libra, entrega y, en ticket, trámite aduanero). Nunca crea una cotización sin líneas.",
  parametros: {
    type: "object",
    properties: {
      cliente: { type: "string", description: "Nombre de la empresa o cliente (obligatorio)" },
      servicio: { type: "string", enum: ["courier", "aereo", "maritimo_lcl", "maritimo_fcl", "terrestre", "aduanas"], description: "Servicio principal (obligatorio)" },
      ruta_ref: { type: "string", description: "El 'ref' (8 caracteres) del flete que eligió el empleado, tal como lo devolvió buscarFletes" },
      tipo_carga: { type: "string", description: "Ej. 'FCL 20GP', 'FCL 40HC', 'Consolidado marítimo LCL'" },
      incoterm: { type: "string", description: "Ej. FOB, EXW, CIF" },
      cantidad: { type: "number", description: "Cuántos contenedores (por defecto 1)" },
      cbm: { type: "number", description: "Metros cúbicos (LCL)" },
      consignatario: { type: "string", description: "Quien recibe la carga" },
      segmento_courier: { type: "string", enum: ["ticket", "consolidado", "documentos", "compras_internet"], description: "Solo courier. Si no se sabe, pasa valor_mercaderia y el sistema decide (más de $1,000 = ticket)" },
      kilogramos: { type: "number", description: "Peso en kg (obligatorio en courier)" },
      valor_mercaderia: { type: "number", description: "Valor de la mercadería en USD" },
      bultos: { type: "number" },
      medidas: { type: "string", description: "Dimensiones tal como las dijo el empleado" },
      mercaderia: { type: "string", description: "Descripción de la mercadería" },
      origen: { type: "string" },
      destino: { type: "string", description: "Por defecto Guatemala" },
      contacto: { type: "string", description: "Persona de contacto del cliente" },
      telefono: { type: "string" },
      fuera_perimetro: { type: "boolean", description: "Courier con entrega fuera del perímetro capitalino" },
      notas_internas: { type: "string" },
      margen_flete_pct: { type: "number", description: "SOLO administradores: margen % exacto para el flete de esta cotización (no cambia la tarifa guardada)" },
      margenes_cargos: { type: "array", items: { type: "object", properties: { nombre: { type: "string" }, porcentaje: { type: "number" } }, required: ["nombre", "porcentaje"] }, description: "SOLO administradores: margen % exacto para cargos concretos de esta cotización" },
      conceptos_adicionales: { type: "array", items: { type: "string" }, description: "Nombres de otros servicios de la base de tarifas a incluir (ej. 'trámite aduanal'). Busca primero con buscarTarifas si no estás seguro del nombre." },
    },
    required: ["cliente", "servicio"],
  },
  async ejecutar(args, { sesion, adjuntos }: ContextoHerramienta) {
    const r = await crearCotizacionDesdeChat(args as DatosCotizacionChat, sesion);
    if (!r.ok) return r.faltan?.length ? { creada: false, faltan: r.faltan, instruccion: "Pídele esos datos al empleado; no los inventes." } : { creada: false, error: r.error };
    adjuntos.push(r.adjunto);
    return { creada: true, ...r.resumen, instruccion: "Dile el número y el total, y que abajo tiene los botones para descargar el PDF y abrirla. No escribas enlaces." };
  },
};

const actualizarTarifario: HerramientaIA = {
  nombre: "actualizarTarifario",
  descripcion: "Solo administradores. Con el archivo adjunto (foto, PDF o Excel) que mandó el empleado, lee los precios de un proveedor y los compara con su tarifario vigente; deja en el chat una tarjeta para revisar y aplicar. Solo cambia lo que viene distinto o nuevo (lo que el documento no trae no se toca). No guarda nada hasta que el administrador confirme.",
  parametros: {
    type: "object",
    properties: {
      proveedor: { type: "string", description: "Proveedor o empresa del tarifario, ej. HYDE o Charter Link" },
      tarifario: { type: "string", description: "Parte del nombre del tarifario, solo si el proveedor tiene varios vigentes" },
    },
    required: ["proveedor"],
  },
  async ejecutar(args, { sesion, adjuntos, archivo }: ContextoHerramienta) {
    if (!sesion.esAdmin) return { error: "Solo un administrador puede actualizar tarifas." };
    if (!archivo) return { error: "No hay archivo adjunto en este mensaje.", instruccion: "Pídele que adjunte la foto, PDF o Excel con el clip (o arrastrándolo) y vuelva a pedirlo." };
    const buscado = normalizar(String(args.proveedor ?? ""));
    if (!buscado) return { error: "Falta el nombre del proveedor." };
    const supabase = await crearClienteServidor();
    const [{ data: proveedores }, tarifarios] = await Promise.all([supabase.from("proveedores").select("id, nombre").eq("activo", true), listarTarifarios(true)]);
    const proveedor = coincideProveedor(String(args.proveedor), proveedores ?? []);
    const filtro = typeof args.tarifario === "string" ? normalizar(args.tarifario) : "";
    let candidatos = tarifarios.filter((t) => t.estado !== "desactivado" && ((proveedor && t.proveedor_id === proveedor.id) || normalizar(t.nombre).includes(buscado)));
    if (filtro) candidatos = candidatos.filter((t) => normalizar(t.nombre).includes(filtro));
    if (!candidatos.length) {
      return { error: `No encontré un tarifario de «${args.proveedor}».`, tarifarios_disponibles: tarifarios.filter((t) => t.estado !== "desactivado").slice(0, 20).map((t) => t.nombre), instruccion: "Pregúntale cuál es el correcto, o sugiérele crear uno nuevo con «Nuevo con IA» en Base de tarifas." };
    }
    const vigentes = candidatos.filter((t) => t.estado === "en_uso" || t.estado === "por_vencer");
    const posibles = vigentes.length ? vigentes : candidatos;
    if (posibles.length > 1) return { ambiguo: true, tarifarios: posibles.map((t) => t.nombre), instruccion: "Pregúntale cuál de estos tarifarios quiere actualizar y vuelve a llamar con el parámetro 'tarifario'." };
    const elegido = posibles[0];
    let extraccion;
    try {
      extraccion = await extraerTarifarioDeDocumento(archivo);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "No pude leer el documento." };
    }
    const propuesta = await proponerActualizacion(elegido.id, extraccion);
    if (!propuesta) return { error: "No encontré ese tarifario." };
    const r = resumenCambios(propuesta.cambios);
    adjuntos.push({ tipo: "actualizacion_tarifa", tarifarioId: elegido.id, tarifarioNombre: elegido.nombre, nuevos: r.nuevos, cambian: r.cambian, iguales: r.iguales, propuesta });
    return {
      tarifario: elegido.nombre, ...r,
      vigente_hasta_segun_documento: propuesta.vigencia_hasta || null,
      ejemplos: propuesta.cambios.filter((c) => c.estado !== "igual").slice(0, 6).map((c) => `${c.etiqueta}: ${c.anterior?.costo ?? "nuevo"} → ${c.fila.costo}`),
      instruccion: "Resume en pocas líneas qué cambia. Debajo aparece la tarjeta «Revisar y aplicar»; todavía NO se aplicó nada. Si el documento no trae fecha de vigencia, pregúntale hasta cuándo valen estas tarifas.",
    };
  },
};

const cambiarMargen: HerramientaIA = {
  nombre: "cambiarMargen",
  descripcion: "SOLO administradores. Cambia de forma PERMANENTE el margen (%) de una tarifa guardada: un flete (ruta_ref de buscarFletes) o un cargo (por nombre). Afecta a todas las cotizaciones futuras. Antes pregúntale al administrador si lo quiere permanente o solo para la cotización en curso; si es solo para la cotización usa margen_flete_pct / margenes_cargos en crearCotizacion. Solo llámala con confirmado=true después de que él lo confirme explícitamente.",
  parametros: {
    type: "object",
    properties: {
      ruta_ref: { type: "string", description: "Código de 8 caracteres del flete (de buscarFletes)" },
      concepto: { type: "string", description: "Nombre del cargo cuyo margen se cambia" },
      porcentaje: { type: "number", description: "Nuevo margen en %, entre 0 y 300" },
      confirmado: { type: "boolean", description: "true solo si el administrador confirmó el cambio permanente" },
    },
    required: ["porcentaje", "confirmado"],
  },
  async ejecutar(args, { sesion }: ContextoHerramienta) {
    if (!sesion.esAdmin) return { error: "Solo un administrador puede cambiar márgenes." };
    const pct = Number(args.porcentaje);
    if (!Number.isFinite(pct) || pct < 0 || pct > 300) return { error: "El margen debe estar entre 0 y 300 %." };
    if (args.confirmado !== true) return { error: "Falta la confirmación.", instruccion: "Pregúntale si quiere cambiarlo de forma permanente para todas las cotizaciones futuras y vuelve a llamar con confirmado=true solo si dice que sí." };
    const supabase = await crearClienteServidor();
    const { recargos } = await leerConfig();
    const catalogo = await catalogoParaCotizar({ ocultarCostos: false, recargos });
    const ref = typeof args.ruta_ref === "string" ? args.ruta_ref.toLowerCase().replace(/^ref:/, "") : "";
    if (ref) {
      const r = catalogo.rutas.find((x) => x.id.toLowerCase().startsWith(ref));
      if (!r) return { error: "No encontré ese flete entre los tarifarios vigentes." };
      if (r.costo == null) return { error: "Ese flete no tiene precio de compra, no se le puede aplicar un margen." };
      const antes = ventaRuta(r, catalogo.tarifarios.find((t) => t.id === r.tarifario_id)?.moneda ?? "USD", recargos);
      const { error } = await supabase.from("tarifas_ruta").update({ tipo_margen: "porcentaje", valor_margen: pct }).eq("id", r.id);
      if (error) return { error: "No se pudo guardar el cambio." };
      const despues = ventaRuta({ ...r, tipo_margen: "porcentaje", valor_margen: pct }, catalogo.tarifarios.find((t) => t.id === r.tarifario_id)?.moneda ?? "USD", recargos);
      return { cambiado: true, flete: `${r.origen}${r.naviera ? ` · ${r.naviera}` : ""}${r.variante ? ` · ${r.variante}` : ""}`, margen_nuevo: `${pct}%`, precio_venta_antes: antes, precio_venta_ahora: despues };
    }
    const buscado = normalizar(String(args.concepto ?? ""));
    if (!buscado) return { error: "Dime qué flete (ruta_ref) o qué cargo (concepto) cambiar." };
    const candidatos = catalogo.conceptos.filter((c) => normalizar(c.nombre).includes(buscado));
    const exacto = candidatos.filter((c) => normalizar(c.nombre) === buscado);
    const lista = exacto.length === 1 ? exacto : candidatos;
    if (lista.length === 0) return { error: `No encontré ningún cargo llamado «${args.concepto}».` };
    if (lista.length > 1) return { ambiguo: true, opciones: lista.slice(0, 8).map((c) => c.nombre), instruccion: "Pregúntale cuál de estos cargos." };
    const c = lista[0];
    if (c.cuenta_ajena || (c.tipo_margen === "precio_fijo" && Number(c.costo) <= 0)) return { error: `«${c.nombre}» es un precio fijo o un pago a tercero: no tiene margen sobre un costo.` };
    const venta = (tipo: typeof c.tipo_margen, valor: number) => ventaLinea({ nombre: c.nombre, categoria: c.categoria, moneda: c.moneda, cantidad: 1, costo_unitario: Number(c.costo), tipo_margen: tipo, valor_margen: valor, lleva_iva: c.aplica_iva, aplica_recargos: c.aplica_recargos }, recargos);
    const antes = venta(c.tipo_margen, Number(c.valor_margen));
    const { error } = await supabase.from("conceptos").update({ tipo_margen: "porcentaje", valor_margen: pct }).eq("id", c.id);
    if (error) return { error: "No se pudo guardar el cambio." };
    return { cambiado: true, cargo: c.nombre, margen_anterior: c.tipo_margen === "porcentaje" ? `${c.valor_margen}%` : `${c.tipo_margen} ${c.valor_margen}`, margen_nuevo: `${pct}%`, precio_venta_antes: antes, precio_venta_ahora: venta("porcentaje", pct) };
  },
};

/** Herramientas disponibles según el rol: la de otros usuarios solo se le ofrece a un administrador. */
export function herramientasDisponibles(esAdmin: boolean): HerramientaIA[] {
  const base = [buscarCotizaciones, obtenerUltimaCotizacion, resumenMetricas, buscarTarifas, buscarProveedor, buscarTarifarios, buscarClientes, buscarFletesHerramienta, crearCotizacion];
  return esAdmin ? [...base, cotizacionesPorUsuario, actualizarTarifario, cambiarMargen] : base;
}
