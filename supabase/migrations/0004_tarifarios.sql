-- Fase 2: tipos de servicio, tarifarios por proveedor con vigencia y documento, rutas,
-- secciones, archivado (nunca borrar por defecto), recargos ISR/no domiciliada, notas por línea.

-- 1. Tipo de servicio de la cotización (primer paso al crear una nueva)
create type tipo_servicio as enum ('maritimo_fcl','maritimo_lcl','aereo','courier','terrestre','aduanas');

alter table cotizaciones add column if not exists tipo_servicio tipo_servicio not null default 'maritimo_fcl';

-- 2. Unidades nuevas que aparecen en tarifarios reales (TACSA)
alter type unidad_concepto add value if not exists 'pie_cubico';
alter type unidad_concepto add value if not exists 'guia';
alter type unidad_concepto add value if not exists 'factura';

-- 3. Tarifarios: un documento de precios de un proveedor (o propio) para un servicio, con vigencia
create table tarifarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  proveedor_id uuid references proveedores(id) on delete set null,   -- null = tarifa propia de Dams Cargo
  servicio tipo_servicio,                                             -- null = aplica a varios
  seccion text not null,                                              -- catálogo en lib/etiquetas (flete_maritimo, flete_aereo, courier, gastos_origen, ...)
  origen text,                                                        -- tramo, ej. "Miami" / "Asia"
  destino text default 'Guatemala',
  moneda moneda not null default 'USD',
  vigencia_desde date,
  vigencia_hasta date,
  documento_url text,                                                 -- PDF/Excel original guardado en Storage
  notas text,
  archivado_at timestamptz,                                           -- null = activo
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tarifarios_activos_idx on tarifarios (seccion, proveedor_id) where archivado_at is null;
create trigger tarifarios_updated before update on tarifarios for each row execute function set_updated_at();
create trigger tarifarios_creado_por before insert on tarifarios for each row execute function set_creado_por();
alter table tarifarios enable row level security;
create policy "auth todo" on tarifarios for all to authenticated using (true) with check (true);

-- 4. Conceptos: sección, tarifario, recargos, mínimo, rango de peso, pendiente de monto, archivado
alter table conceptos
  add column if not exists seccion text,
  add column if not exists tarifario_id uuid references tarifarios(id) on delete set null,
  add column if not exists aplica_recargos boolean not null default false,
  add column if not exists minimo numeric(12,2),            -- mínimo por envío en la moneda del concepto
  add column if not exists rango_desde numeric(12,2),       -- tramos por peso (ej. entrega a domicilio 133–300 lb)
  add column if not exists rango_hasta numeric(12,2),
  add column if not exists pendiente boolean not null default false,   -- "falta monto"
  add column if not exists archivado_at timestamptz;

-- Sección por defecto derivada de la categoría para lo ya existente
update conceptos set seccion = case categoria
  when 'internacional' then 'flete_maritimo'
  when 'local' then 'gastos_locales'
  when 'naviera' then 'naviera' end
where seccion is null;
alter table conceptos alter column seccion set not null;
-- Lo que estaba inactivo pasa a archivado
update conceptos set archivado_at = now() where activo = false and archivado_at is null;
create index conceptos_activos_idx on conceptos (seccion, orden) where archivado_at is null;

-- 5. Rutas de flete (tarifarios por ruta, ej. LCL Asia de Charter Link: costo por CBM por origen)
create table tarifas_ruta (
  id uuid primary key default gen_random_uuid(),
  tarifario_id uuid not null references tarifarios(id) on delete cascade,
  pais text,
  origen text not null,
  destino text not null default 'Guatemala',
  via text,
  costo numeric(12,2),                     -- null = falta monto
  unidad unidad_concepto not null default 'cbm',
  minimo numeric(12,2),
  transito text,                           -- "30-35" días
  tipo_margen tipo_margen not null default 'porcentaje',
  valor_margen numeric(12,2) not null default 0,
  aplica_recargos boolean not null default true,
  notas text,
  archivado_at timestamptz,
  created_at timestamptz not null default now()
);
create index tarifas_ruta_tarifario_idx on tarifas_ruta (tarifario_id) where archivado_at is null;
alter table tarifas_ruta enable row level security;
create policy "auth todo" on tarifas_ruta for all to authenticated using (true) with check (true);

-- 6. Tarifas especiales por cliente: sobreescriben el margen de un concepto para ese cliente
create table tarifas_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  concepto_id uuid not null references conceptos(id) on delete cascade,
  tipo_margen tipo_margen not null,
  valor_margen numeric(12,2) not null,
  notas text,
  created_at timestamptz not null default now(),
  unique (cliente_id, concepto_id)
);
alter table tarifas_cliente enable row level security;
create policy "auth todo" on tarifas_cliente for all to authenticated using (true) with check (true);

-- 7. Líneas de cotización: recargos, nota, proveedor y ruta congelados
alter table cotizacion_lineas
  add column if not exists aplica_recargos boolean not null default false,
  add column if not exists nota text,
  add column if not exists nota_visible boolean not null default true,
  add column if not exists proveedor_nombre text,
  add column if not exists ruta text;

-- 8. Recargos globales (ISR y no domiciliada) en config
insert into config (clave, valor) values ('recargos', '{"isr_pct": 7, "no_domiciliada_pct": 5.263}'::jsonb)
on conflict (clave) do nothing;

-- 9. guardar_cotizacion: tipo_servicio y campos nuevos de línea
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
      incoterm, descuentos, notas, tipo_servicio
    )
    select
      siguiente_numero_cotizacion(), c.cliente_id, c.cliente_nombre, c.contacto, c.fecha, c.dias_vigencia, c.tipo_carga,
      c.kilogramos, c.kg_volumetricos, c.cbm, c.bultos, c.medidas, c.mercaderia, c.origen, coalesce(c.destino, 'Guatemala'), c.transito, c.routing,
      c.tipo_cambio, coalesce(c.estado, 'borrador'), c.total_usd, c.total_gtq, c.costo_total_gtq, c.utilidad_gtq, c.margen_pct, c.notas_internas,
      c.incoterm, coalesce(c.descuentos, '[]'::jsonb), c.notas, coalesce(c.tipo_servicio, 'maritimo_fcl')
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio
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
      tipo_servicio = coalesce(c.tipo_servicio, z.tipo_servicio)
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio
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
    aplica_recargos, nota, nota_visible, proveedor_nombre, ruta
  )
  select v_id, l.concepto_id, l.nombre, l.categoria, l.moneda, l.cantidad, l.costo_unitario,
         l.tipo_margen, l.valor_margen, l.lleva_iva, l.venta_total, coalesce(l.venta_bruta, l.venta_total), l.orden,
         coalesce(l.aplica_recargos, false), l.nota, coalesce(l.nota_visible, true), l.proveedor_nombre, l.ruta
  from jsonb_to_recordset(p_lineas) as l(
    concepto_id uuid, nombre text, categoria categoria_concepto, moneda moneda, cantidad numeric,
    costo_unitario numeric, tipo_margen tipo_margen, valor_margen numeric, lleva_iva boolean,
    venta_total numeric, venta_bruta numeric, orden int,
    aplica_recargos boolean, nota text, nota_visible boolean, proveedor_nombre text, ruta text
  );

  return v_id;
end $$;
