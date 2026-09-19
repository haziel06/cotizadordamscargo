-- Courier pulido: conceptos por servicio, consignatario, entrega fuera del perímetro,
-- y la entrega a domicilio de paquetes pequeños queda como incluida (no "falta monto").

-- Cada concepto puede limitarse a ciertos servicios. Vacío = aplica a todos.
alter table conceptos add column if not exists servicios tipo_servicio[] not null default '{}';

update conceptos set servicios = '{maritimo_fcl}' where nombre = 'Trámite de Aduana (FCL)';
update conceptos set servicios = '{maritimo_fcl,maritimo_lcl,terrestre,aduanas}' where nombre in ('Duca de traslado');
update conceptos set servicios = '{maritimo_fcl,maritimo_lcl,aereo,aduanas}' where nombre in ('Elaboración de TLC (tratado de libre comercio)', 'Transmisión de Declaración', 'Rectificación');
update conceptos set servicios = '{maritimo_lcl,aereo,courier,aduanas}' where nombre = 'Trámite aduanal (LCL / aéreo / courier)';
update conceptos set servicios = '{courier}' where seccion in ('courier', 'gastos_ajenos');
update conceptos set servicios = '{aereo}' where nombre in ('Carga express aérea (por libra)', 'Coordinación, desconsolidación y almacenaje (por guía)', 'SED / AES (facturas > $2,500)') and seccion = 'courier';
update conceptos set servicios = '{aereo,courier}' where seccion = 'entrega_domicilio';

-- Paquetes pequeños: la entrega dentro del perímetro capitalino ya va incluida en la libra.
update conceptos set
  nombre = 'Entrega a domicilio (incluida, perímetro capitalino)',
  costo = 0, tipo_margen = 'precio_fijo', valor_margen = 0, aplica_recargos = false, aplica_iva = false, pendiente = false,
  notas = 'Hasta 132 lb la entrega dentro del perímetro capitalino va incluida en el precio por libra. Fuera del perímetro se envía con expreso externo y el costo se cobra aparte según destino.'
where nombre = 'Entrega a domicilio hasta 132 lb';

-- Cabecera: consignatario aparte del contacto; entrega para courier.
alter table cotizaciones
  add column if not exists consignatario text,
  add column if not exists direccion_entrega text,
  add column if not exists fuera_perimetro boolean not null default false;

create or replace function guardar_cotizacion(p_id uuid, p_cabecera jsonb, p_lineas jsonb)
returns uuid language plpgsql security invoker as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into cotizaciones (
      numero, cliente_id, cliente_nombre, contacto, fecha, dias_vigencia, tipo_carga,
      kilogramos, kg_volumetricos, cbm, bultos, medidas, mercaderia, origen, destino, transito, routing,
      tipo_cambio, estado, total_usd, total_gtq, costo_total_gtq, utilidad_gtq, margen_pct, notas_internas,
      incoterm, descuentos, notas, tipo_servicio, tipos_servicio, cliente_telefono, segmento_courier, valor_mercaderia,
      consignatario, direccion_entrega, fuera_perimetro
    )
    select
      siguiente_numero_cotizacion(), c.cliente_id, c.cliente_nombre, c.contacto, c.fecha, c.dias_vigencia, c.tipo_carga,
      c.kilogramos, c.kg_volumetricos, c.cbm, c.bultos, c.medidas, c.mercaderia, c.origen, coalesce(c.destino, 'Guatemala'), c.transito, c.routing,
      c.tipo_cambio, coalesce(c.estado, 'borrador'), c.total_usd, c.total_gtq, c.costo_total_gtq, c.utilidad_gtq, c.margen_pct, c.notas_internas,
      c.incoterm, coalesce(c.descuentos, '[]'::jsonb), c.notas, coalesce(c.tipo_servicio, 'maritimo_fcl'),
      coalesce(c.tipos_servicio, array[coalesce(c.tipo_servicio, 'maritimo_fcl')]), c.cliente_telefono, c.segmento_courier, c.valor_mercaderia,
      c.consignatario, c.direccion_entrega, coalesce(c.fuera_perimetro, false)
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio, tipos_servicio tipo_servicio[],
      cliente_telefono text, segmento_courier text, valor_mercaderia numeric,
      consignatario text, direccion_entrega text, fuera_perimetro boolean
    )
    returning id into v_id;
  else
    update cotizaciones z set
      cliente_id = c.cliente_id, cliente_nombre = c.cliente_nombre, contacto = c.contacto, fecha = c.fecha,
      dias_vigencia = c.dias_vigencia, tipo_carga = c.tipo_carga, kilogramos = c.kilogramos,
      kg_volumetricos = c.kg_volumetricos, cbm = c.cbm, bultos = c.bultos, medidas = c.medidas,
      mercaderia = c.mercaderia, origen = c.origen, destino = coalesce(c.destino, 'Guatemala'), transito = c.transito,
      routing = c.routing, tipo_cambio = c.tipo_cambio, estado = coalesce(c.estado, z.estado),
      total_usd = c.total_usd, total_gtq = c.total_gtq, costo_total_gtq = c.costo_total_gtq,
      utilidad_gtq = c.utilidad_gtq, margen_pct = c.margen_pct, notas_internas = c.notas_internas,
      incoterm = c.incoterm, descuentos = coalesce(c.descuentos, '[]'::jsonb), notas = c.notas,
      tipo_servicio = coalesce(c.tipo_servicio, z.tipo_servicio),
      tipos_servicio = coalesce(c.tipos_servicio, z.tipos_servicio),
      cliente_telefono = c.cliente_telefono, segmento_courier = c.segmento_courier, valor_mercaderia = c.valor_mercaderia,
      consignatario = c.consignatario, direccion_entrega = c.direccion_entrega, fuera_perimetro = coalesce(c.fuera_perimetro, false)
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio, tipos_servicio tipo_servicio[],
      cliente_telefono text, segmento_courier text, valor_mercaderia numeric,
      consignatario text, direccion_entrega text, fuera_perimetro boolean
    )
    where z.id = v_id;
    if not found then
      raise exception 'Cotización no encontrada';
    end if;
  end if;

  delete from cotizacion_lineas where cotizacion_id = v_id;

  insert into cotizacion_lineas (
    cotizacion_id, concepto_id, nombre, categoria, moneda, cantidad, costo_unitario,
    tipo_margen, valor_margen, lleva_iva, venta_total, venta_bruta, orden,
    aplica_recargos, nota, nota_visible, proveedor_nombre, ruta, cuenta_ajena, ruta_id
  )
  select v_id, l.concepto_id, l.nombre, l.categoria, l.moneda, l.cantidad, l.costo_unitario,
         l.tipo_margen, l.valor_margen, l.lleva_iva, l.venta_total, coalesce(l.venta_bruta, l.venta_total), l.orden,
         coalesce(l.aplica_recargos, false), l.nota, coalesce(l.nota_visible, true), l.proveedor_nombre, l.ruta,
         coalesce(l.cuenta_ajena, false), l.ruta_id
  from jsonb_to_recordset(p_lineas) as l(
    concepto_id uuid, nombre text, categoria categoria_concepto, moneda moneda, cantidad numeric,
    costo_unitario numeric, tipo_margen tipo_margen, valor_margen numeric, lleva_iva boolean,
    venta_total numeric, venta_bruta numeric, orden int, aplica_recargos boolean, nota text, nota_visible boolean,
    proveedor_nombre text, ruta text, cuenta_ajena boolean, ruta_id uuid
  );

  return v_id;
end $$;

-- La entrega incluida se lista junto al courier (bloque internacional), no como bloque local vacío.
update conceptos set categoria = 'internacional', moneda = 'USD' where nombre = 'Entrega a domicilio (incluida, perímetro capitalino)';
