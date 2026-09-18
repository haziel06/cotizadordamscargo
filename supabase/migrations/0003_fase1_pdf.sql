-- Fase 1: incoterm, descuentos, notas por cotización, autor, perfiles de usuario, sello.

alter table cotizaciones
  add column if not exists incoterm text,
  add column if not exists descuentos jsonb not null default '[]'::jsonb,
  -- null = usar las notas de Configuración. Si se editan, se congela la copia aquí.
  add column if not exists notas jsonb,
  add column if not exists creado_por uuid references auth.users(id) on delete set null;

-- venta_total ahora es la venta FINAL (con descuento repartido); se conserva la venta sin descuento aparte.
alter table cotizacion_lineas
  add column if not exists venta_bruta numeric(12,2);
update cotizacion_lineas set venta_bruta = venta_total where venta_bruta is null;
alter table cotizacion_lineas alter column venta_bruta set not null, alter column venta_bruta set default 0;

-- Datos de quien cotiza: van en la firma del PDF y sirven para métricas por usuario.
create table if not exists perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  cargo text not null default '',
  correo text not null default '',
  telefono text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table perfiles enable row level security;
create policy "leer todos" on perfiles for select to authenticated using (true);
create policy "editar propio" on perfiles for insert to authenticated with check (auth.uid() = user_id);
create policy "actualizar propio" on perfiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger perfiles_updated before update on perfiles for each row execute function set_updated_at();

-- creado_por se llena solo con el usuario de la sesión.
create or replace function set_creado_por()
returns trigger language plpgsql as $$
begin
  if new.creado_por is null then
    new.creado_por := auth.uid();
  end if;
  return new;
end $$;
create trigger cotizaciones_creado_por before insert on cotizaciones for each row execute function set_creado_por();

-- guardar_cotizacion: acepta los campos nuevos.
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
      incoterm, descuentos, notas
    )
    select
      siguiente_numero_cotizacion(), c.cliente_id, c.cliente_nombre, c.contacto, c.fecha, c.dias_vigencia, c.tipo_carga,
      c.kilogramos, c.kg_volumetricos, c.cbm, c.bultos, c.medidas, c.mercaderia, c.origen, coalesce(c.destino, 'Guatemala'), c.transito, c.routing,
      c.tipo_cambio, coalesce(c.estado, 'borrador'), c.total_usd, c.total_gtq, c.costo_total_gtq, c.utilidad_gtq, c.margen_pct, c.notas_internas,
      c.incoterm, coalesce(c.descuentos, '[]'::jsonb), c.notas
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb
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
      incoterm = c.incoterm, descuentos = coalesce(c.descuentos, '[]'::jsonb), notas = c.notas
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb
    )
    where z.id = v_id;
    if not found then
      raise exception 'Cotización no encontrada';
    end if;
  end if;

  delete from cotizacion_lineas where cotizacion_id = v_id;

  insert into cotizacion_lineas (
    cotizacion_id, concepto_id, nombre, categoria, moneda, cantidad, costo_unitario,
    tipo_margen, valor_margen, lleva_iva, venta_total, venta_bruta, orden
  )
  select v_id, l.concepto_id, l.nombre, l.categoria, l.moneda, l.cantidad, l.costo_unitario,
         l.tipo_margen, l.valor_margen, l.lleva_iva, l.venta_total, coalesce(l.venta_bruta, l.venta_total), l.orden
  from jsonb_to_recordset(p_lineas) as l(
    concepto_id uuid, nombre text, categoria categoria_concepto, moneda moneda, cantidad numeric,
    costo_unitario numeric, tipo_margen tipo_margen, valor_margen numeric, lleva_iva boolean,
    venta_total numeric, venta_bruta numeric, orden int
  );

  return v_id;
end $$;
