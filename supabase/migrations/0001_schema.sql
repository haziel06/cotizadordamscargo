-- Cotizador Dams Cargo — esquema inicial (spec §4)

create extension if not exists pgcrypto;

create type tipo_proveedor as enum ('naviera','agente_origen','transportista','courier','almacenadora','custodio','otro');
create type moneda as enum ('USD','GTQ');
create type categoria_concepto as enum ('internacional','local','naviera');
create type unidad_concepto as enum ('envio','contenedor','kg','cbm','libra');
create type tipo_margen as enum ('porcentaje','monto_fijo','precio_fijo');
create type estado_cotizacion as enum ('borrador','enviada','aceptada','rechazada','vencida');

create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo tipo_proveedor not null default 'otro',
  pais text,
  moneda_default moneda not null default 'USD',
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table conceptos (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references proveedores(id) on delete set null,
  nombre text not null,
  categoria categoria_concepto not null,
  moneda moneda not null,
  unidad unidad_concepto not null default 'envio',
  costo numeric(12,2) not null default 0,
  tipo_margen tipo_margen not null default 'porcentaje',
  valor_margen numeric(12,2) not null default 0,
  aplica_iva boolean not null default true,
  orden integer not null default 0,
  activo boolean not null default true,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nit text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nombre text not null,
  contacto text,
  fecha date not null default current_date,
  dias_vigencia integer not null default 15,
  tipo_carga text,
  kilogramos numeric(12,2),
  kg_volumetricos numeric(12,2),
  cbm numeric(12,3),
  bultos integer,
  medidas text,
  mercaderia text,
  origen text,
  destino text not null default 'Guatemala',
  transito text,
  routing text,
  tipo_cambio numeric(6,4) not null,
  estado estado_cotizacion not null default 'borrador',
  total_usd numeric(12,2) not null default 0,
  total_gtq numeric(12,2) not null default 0,
  costo_total_gtq numeric(12,2) not null default 0,
  utilidad_gtq numeric(12,2) not null default 0,
  margen_pct numeric(6,2) not null default 0,
  notas_internas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cotizaciones_fecha_idx on cotizaciones (fecha desc);
create index cotizaciones_cliente_idx on cotizaciones (lower(cliente_nombre));

-- Copia congelada: cambiar una tarifa hoy no altera cotizaciones guardadas ayer.
create table cotizacion_lineas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references cotizaciones(id) on delete cascade,
  concepto_id uuid references conceptos(id) on delete set null,
  nombre text not null,
  categoria categoria_concepto not null,
  moneda moneda not null,
  cantidad numeric(12,3) not null default 1,
  costo_unitario numeric(12,2) not null default 0,
  tipo_margen tipo_margen not null,
  valor_margen numeric(12,2) not null default 0,
  lleva_iva boolean not null default true,
  venta_total numeric(12,2) not null default 0,
  orden integer not null default 0
);
create index cotizacion_lineas_cot_idx on cotizacion_lineas (cotizacion_id, orden);
create index cotizacion_lineas_concepto_idx on cotizacion_lineas (concepto_id);

create table config (
  clave text primary key,
  valor jsonb not null,
  updated_at timestamptz not null default now()
);

-- Correlativo COT-AAAA-#### sin duplicados aunque dos personas guarden a la vez.
create table correlativos (
  anio integer primary key,
  ultimo integer not null default 0
);

create or replace function siguiente_numero_cotizacion()
returns text language plpgsql as $$
declare
  a integer := extract(year from current_date)::integer;
  n integer;
begin
  insert into correlativos (anio, ultimo) values (a, 1)
  on conflict (anio) do update set ultimo = correlativos.ultimo + 1
  returning ultimo into n;
  return format('COT-%s-%s', a, lpad(n::text, 4, '0'));
end $$;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger conceptos_updated before update on conceptos for each row execute function set_updated_at();
create trigger cotizaciones_updated before update on cotizaciones for each row execute function set_updated_at();
create trigger config_updated before update on config for each row execute function set_updated_at();

-- RLS: un solo tipo de usuario. Cualquier sesión autenticada puede todo; anónimos nada.
alter table proveedores enable row level security;
alter table conceptos enable row level security;
alter table clientes enable row level security;
alter table cotizaciones enable row level security;
alter table cotizacion_lineas enable row level security;
alter table config enable row level security;
alter table correlativos enable row level security;

create policy "auth todo" on proveedores for all to authenticated using (true) with check (true);
create policy "auth todo" on conceptos for all to authenticated using (true) with check (true);
create policy "auth todo" on clientes for all to authenticated using (true) with check (true);
create policy "auth todo" on cotizaciones for all to authenticated using (true) with check (true);
create policy "auth todo" on cotizacion_lineas for all to authenticated using (true) with check (true);
create policy "auth todo" on config for all to authenticated using (true) with check (true);
create policy "auth todo" on correlativos for all to authenticated using (true) with check (true);

-- Storage: bucket público para el logo, escritura solo autenticados.
insert into storage.buckets (id, name, public) values ('config', 'config', true)
on conflict (id) do nothing;
create policy "logo lectura publica" on storage.objects for select using (bucket_id = 'config');
create policy "logo escritura auth" on storage.objects for insert to authenticated with check (bucket_id = 'config');
create policy "logo actualizar auth" on storage.objects for update to authenticated using (bucket_id = 'config');
create policy "logo borrar auth" on storage.objects for delete to authenticated using (bucket_id = 'config');
