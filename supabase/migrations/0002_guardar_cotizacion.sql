-- Guarda cabecera + líneas en una sola transacción. Al crear, asigna el correlativo.
-- Las líneas se reemplazan completas: son la copia congelada de costos y márgenes.
create or replace function guardar_cotizacion(p_id uuid, p_cabecera jsonb, p_lineas jsonb)
returns uuid language plpgsql security invoker as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into cotizaciones (
      numero, cliente_id, cliente_nombre, contacto, fecha, dias_vigencia, tipo_carga,
      kilogramos, kg_volumetricos, cbm, bultos, medidas, mercaderia, origen, destino, transito, routing,
      tipo_cambio, estado, total_usd, total_gtq, costo_total_gtq, utilidad_gtq, margen_pct, notas_internas
    )
    select
      siguiente_numero_cotizacion(), c.cliente_id, c.cliente_nombre, c.contacto, c.fecha, c.dias_vigencia, c.tipo_carga,
      c.kilogramos, c.kg_volumetricos, c.cbm, c.bultos, c.medidas, c.mercaderia, c.origen, coalesce(c.destino, 'Guatemala'), c.transito, c.routing,
      c.tipo_cambio, coalesce(c.estado, 'borrador'), c.total_usd, c.total_gtq, c.costo_total_gtq, c.utilidad_gtq, c.margen_pct, c.notas_internas
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text
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
      utilidad_gtq = c.utilidad_gtq, margen_pct = c.margen_pct, notas_internas = c.notas_internas
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text
    )
    where z.id = v_id;
    if not found then
      raise exception 'Cotización no encontrada';
    end if;
  end if;

  delete from cotizacion_lineas where cotizacion_id = v_id;

  insert into cotizacion_lineas (
    cotizacion_id, concepto_id, nombre, categoria, moneda, cantidad, costo_unitario,
    tipo_margen, valor_margen, lleva_iva, venta_total, orden
  )
  select v_id, l.concepto_id, l.nombre, l.categoria, l.moneda, l.cantidad, l.costo_unitario,
         l.tipo_margen, l.valor_margen, l.lleva_iva, l.venta_total, l.orden
  from jsonb_to_recordset(p_lineas) as l(
    concepto_id uuid, nombre text, categoria categoria_concepto, moneda moneda, cantidad numeric,
    costo_unitario numeric, tipo_margen tipo_margen, valor_margen numeric, lleva_iva boolean,
    venta_total numeric, orden int
  );

  return v_id;
end $$;
