-- Fase 3: roles (admin / usuario), clave de administrador, invitaciones, multi-servicio,
-- cliente en tres partes, courier (segmento, valor de mercadería), gastos por cuenta ajena.

create extension if not exists pgcrypto with schema extensions;

-- ===== 1. Perfiles con rol =====
alter table perfiles
  add column if not exists rol text not null default 'usuario' check (rol in ('admin', 'usuario')),
  add column if not exists activo boolean not null default true,
  add column if not exists email text not null default '';

-- Admin raíz: no se le puede quitar el rol desde la app.
create or replace function correo_admin_raiz() returns text language sql immutable as $$ select 'hazielrsm0006@gmail.com' $$;

create or replace function es_admin() returns boolean language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select rol = 'admin' and activo from perfiles where user_id = auth.uid()), false)
$$;

-- El perfil del admin raíz existe y es admin.
insert into perfiles (user_id, rol, email)
select id, 'admin', email from auth.users where email = correo_admin_raiz()
on conflict (user_id) do update set rol = 'admin', activo = true, email = excluded.email;

-- Cualquier usuario puede leer perfiles (nombres para el PDF y para el filtro por persona);
-- solo el propio usuario o un admin puede editar. El rol solo lo cambia un admin (vía RPC).
drop policy if exists "editar propio" on perfiles;
drop policy if exists "actualizar propio" on perfiles;
create policy "insertar propio" on perfiles for insert to authenticated with check (auth.uid() = user_id);
create policy "actualizar propio o admin" on perfiles for update to authenticated
  using (auth.uid() = user_id or es_admin()) with check (auth.uid() = user_id or es_admin());

-- Nadie cambia su propio rol por UPDATE directo: el trigger lo devuelve al valor anterior salvo que venga de una RPC.
create or replace function proteger_rol_perfil() returns trigger language plpgsql as $$
begin
  if new.rol is distinct from old.rol or new.activo is distinct from old.activo then
    if current_setting('app.cambio_rol', true) is distinct from 'si' then
      new.rol := old.rol;
      new.activo := old.activo;
    end if;
  end if;
  if old.email = correo_admin_raiz() then
    new.rol := 'admin';
    new.activo := true;
  end if;
  return new;
end $$;
drop trigger if exists perfiles_proteger_rol on perfiles;
create trigger perfiles_proteger_rol before update on perfiles for each row execute function proteger_rol_perfil();

-- ===== 2. Clave de administrador (hash) =====
create table if not exists secretos (
  clave text primary key,
  hash text not null,
  actualizado_at timestamptz not null default now(),
  actualizado_por uuid
);
alter table secretos enable row level security; -- sin políticas: solo funciones security definer.

create or replace function generar_clave_admin() returns text language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bloque text; salida text := 'DAMS'; i int; j int;
begin
  for i in 1..3 loop
    bloque := '';
    for j in 1..4 loop
      bloque := bloque || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    salida := salida || '-' || bloque;
  end loop;
  return salida;
end $$;

-- Solo un admin puede regenerar. Devuelve la clave en claro UNA vez; se guarda el hash.
create or replace function regenerar_clave_admin() returns text language plpgsql security definer set search_path = public, extensions as $$
declare v text;
begin
  if not es_admin() then raise exception 'Solo un administrador puede hacer esto'; end if;
  v := generar_clave_admin();
  insert into secretos (clave, hash, actualizado_por) values ('clave_admin', crypt(v, gen_salt('bf')), auth.uid())
  on conflict (clave) do update set hash = excluded.hash, actualizado_at = now(), actualizado_por = auth.uid();
  return v;
end $$;

-- Un usuario normal escribe la clave una vez y queda como admin.
create or replace function canjear_clave_admin(p_clave text) returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare h text;
begin
  if auth.uid() is null then return false; end if;
  select hash into h from secretos where clave = 'clave_admin';
  if h is null or crypt(trim(p_clave), h) <> h then return false; end if;
  perform set_config('app.cambio_rol', 'si', true);
  update perfiles set rol = 'admin', activo = true where user_id = auth.uid();
  return true;
end $$;

-- Un admin sube/baja el rol o activa/desactiva a otro usuario.
create or replace function cambiar_rol_usuario(p_user uuid, p_rol text, p_activo boolean) returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not es_admin() then raise exception 'Solo un administrador puede hacer esto'; end if;
  if p_rol not in ('admin', 'usuario') then raise exception 'Rol inválido'; end if;
  perform set_config('app.cambio_rol', 'si', true);
  update perfiles set rol = p_rol, activo = p_activo where user_id = p_user;
end $$;

-- ===== 3. Invitaciones para registrarse =====
create table if not exists invitaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nota text not null default '',
  usos_max int not null default 1,
  usos int not null default 0,
  vence_at timestamptz,
  activo boolean not null default true,
  creado_por uuid,
  usado_por jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table invitaciones enable row level security;
create policy "admin todo" on invitaciones for all to authenticated using (es_admin()) with check (es_admin());

create or replace function generar_codigo_invitacion() returns text language plpgsql as $$
declare alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; j int;
begin
  for j in 1..6 loop s := s || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1); end loop;
  return 'INV-' || s;
end $$;

-- Al crear un usuario en auth, exige un código de invitación válido (viene en raw_user_meta_data.codigo_invitacion),
-- lo consume y crea el perfil. El admin raíz no necesita código.
create or replace function validar_registro() returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  cod text := upper(trim(coalesce(new.raw_user_meta_data->>'codigo_invitacion', '')));
  inv invitaciones%rowtype;
  rol_nuevo text := 'usuario';
begin
  if new.email = correo_admin_raiz() then
    rol_nuevo := 'admin';
  else
    if cod = '' then raise exception 'Necesitas un código de invitación'; end if;
    select * into inv from invitaciones where codigo = cod for update;
    if inv.id is null or not inv.activo or (inv.vence_at is not null and inv.vence_at < now()) or inv.usos >= inv.usos_max then
      raise exception 'Código de invitación inválido o vencido';
    end if;
    update invitaciones set usos = usos + 1,
      usado_por = usado_por || jsonb_build_object('email', new.email, 'fecha', now())
      where id = inv.id;
  end if;
  insert into perfiles (user_id, rol, email, nombre, correo)
  values (new.id, rol_nuevo, new.email, coalesce(new.raw_user_meta_data->>'nombre', ''), new.email)
  on conflict (user_id) do update set rol = excluded.rol, email = excluded.email;
  return new;
end $$;
drop trigger if exists auth_validar_registro on auth.users;
create trigger auth_validar_registro after insert on auth.users for each row execute function validar_registro();

-- ===== 4. Cotizaciones: multi-servicio, cliente en tres partes, courier =====
alter table cotizaciones
  add column if not exists tipos_servicio tipo_servicio[] not null default '{}',
  add column if not exists cliente_telefono text,
  add column if not exists segmento_courier text check (segmento_courier in ('ticket', 'consolidado', 'documentos')),
  add column if not exists valor_mercaderia numeric(12,2);
update cotizaciones set tipos_servicio = array[tipo_servicio] where cardinality(tipos_servicio) = 0;

alter table clientes add column if not exists empresa text;

alter table cotizacion_lineas
  add column if not exists cuenta_ajena boolean not null default false,
  add column if not exists ruta_id uuid references tarifas_ruta(id) on delete set null;

-- Conceptos que son pagos a terceros (almacenaje Combex, etc.): salen aparte y sin margen.
alter table conceptos add column if not exists cuenta_ajena boolean not null default false;

-- Un usuario normal solo ve y edita sus propias cotizaciones; el admin ve todas.
drop policy if exists "auth todo" on cotizaciones;
create policy "propias o admin" on cotizaciones for all to authenticated
  using (es_admin() or creado_por = auth.uid()) with check (es_admin() or creado_por is null or creado_por = auth.uid());
drop policy if exists "auth todo" on cotizacion_lineas;
create policy "lineas propias o admin" on cotizacion_lineas for all to authenticated
  using (es_admin() or exists (select 1 from cotizaciones c where c.id = cotizacion_id and c.creado_por = auth.uid()))
  with check (es_admin() or exists (select 1 from cotizaciones c where c.id = cotizacion_id and c.creado_por = auth.uid()));

-- Tarifas: solo el admin escribe. Todos leen (el servidor oculta los costos a usuarios normales).
do $$
declare t text;
begin
  foreach t in array array['conceptos', 'proveedores', 'tarifarios', 'tarifas_ruta', 'tarifas_cliente'] loop
    execute format('drop policy if exists "auth todo" on %I', t);
    execute format('drop policy if exists "auth lectura" on %I', t);
    execute format('drop policy if exists "admin escribe" on %I', t);
    execute format('create policy "auth lectura" on %I for select to authenticated using (true)', t);
    execute format('create policy "admin escribe" on %I for insert to authenticated with check (es_admin())', t);
    execute format('create policy "admin actualiza" on %I for update to authenticated using (es_admin()) with check (es_admin())', t);
    execute format('create policy "admin borra" on %I for delete to authenticated using (es_admin())', t);
  end loop;
end $$;

-- ===== 5. guardar_cotizacion con los campos nuevos =====
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
      incoterm, descuentos, notas, tipo_servicio, tipos_servicio, cliente_telefono, segmento_courier, valor_mercaderia
    )
    select
      siguiente_numero_cotizacion(), c.cliente_id, c.cliente_nombre, c.contacto, c.fecha, c.dias_vigencia, c.tipo_carga,
      c.kilogramos, c.kg_volumetricos, c.cbm, c.bultos, c.medidas, c.mercaderia, c.origen, coalesce(c.destino, 'Guatemala'), c.transito, c.routing,
      c.tipo_cambio, coalesce(c.estado, 'borrador'), c.total_usd, c.total_gtq, c.costo_total_gtq, c.utilidad_gtq, c.margen_pct, c.notas_internas,
      c.incoterm, coalesce(c.descuentos, '[]'::jsonb), c.notas, coalesce(c.tipo_servicio, 'maritimo_fcl'),
      coalesce(c.tipos_servicio, array[coalesce(c.tipo_servicio, 'maritimo_fcl')]), c.cliente_telefono, c.segmento_courier, c.valor_mercaderia
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio, tipos_servicio tipo_servicio[],
      cliente_telefono text, segmento_courier text, valor_mercaderia numeric
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
      cliente_telefono = c.cliente_telefono, segmento_courier = c.segmento_courier, valor_mercaderia = c.valor_mercaderia
    from jsonb_to_record(p_cabecera) as c(
      cliente_id uuid, cliente_nombre text, contacto text, fecha date, dias_vigencia int, tipo_carga text,
      kilogramos numeric, kg_volumetricos numeric, cbm numeric, bultos int, medidas text, mercaderia text,
      origen text, destino text, transito text, routing text, tipo_cambio numeric, estado estado_cotizacion,
      total_usd numeric, total_gtq numeric, costo_total_gtq numeric, utilidad_gtq numeric, margen_pct numeric, notas_internas text,
      incoterm text, descuentos jsonb, notas jsonb, tipo_servicio tipo_servicio, tipos_servicio tipo_servicio[],
      cliente_telefono text, segmento_courier text, valor_mercaderia numeric
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

-- ===== 6. Datos de courier =====
-- Venta oficina $3.70/lb: 2.30 × 1.07 × 1.05263 × (1 + 42.83%) = 3.70
update conceptos set valor_margen = 42.83, notas = 'Venta oficina: $3.70/lb (2.30 + ISR + no dom. + 42.83%). Todos los días.'
  where nombre = 'Courier Plus (por libra, peso real)';

-- Sección de gastos por cuenta ajena (pagos a terceros que el cliente cubre aparte).
insert into conceptos (nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, aplica_recargos, pendiente, cuenta_ajena, orden, notas, activo)
select 'Almacenaje Combex-Im (pago a tercero)', 'local', 'gastos_ajenos', 'GTQ', 'envio', 0, 'precio_fijo', 0, false, false, true, true, 10,
       'Cuenta ajena: el cliente paga directo a Combex-Im. Falta monto; se llena según la guía.', true
where not exists (select 1 from conceptos where seccion = 'gastos_ajenos');

-- Comprobación previa (desde el formulario de registro, sin sesión) para dar un mensaje claro.
create or replace function validar_invitacion(p_codigo text) returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from invitaciones
    where codigo = upper(trim(p_codigo)) and activo and usos < usos_max and (vence_at is null or vence_at > now())
  )
$$;
grant execute on function validar_invitacion(text) to anon, authenticated;

-- Config: todos leen, solo admin escribe.
drop policy if exists "auth todo" on config;
create policy "auth lectura" on config for select to authenticated using (true);
create policy "admin escribe" on config for insert to authenticated with check (es_admin());
create policy "admin actualiza" on config for update to authenticated using (es_admin()) with check (es_admin());
create policy "admin borra" on config for delete to authenticated using (es_admin());

-- Entrega a domicilio para paquetes pequeños (TACSA empieza en 133 lb): queda como "falta monto".
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, rango_desde, rango_hasta, tipo_margen, valor_margen, aplica_iva, aplica_recargos, pendiente, orden, notas)
select tarifario_id, proveedor_id, 'Entrega a domicilio hasta 132 lb', 'local', 'entrega_domicilio', 'USD', 'envio', 0, 0, 132, 'porcentaje', 40, true, true, true, 5,
 'El tarifario TACSA empieza en 133 lb. Falta monto para paquetes pequeños: confirmar con TACSA y llenar.'
from conceptos where seccion = 'entrega_domicilio' and not exists (select 1 from conceptos where nombre = 'Entrega a domicilio hasta 132 lb') limit 1;
