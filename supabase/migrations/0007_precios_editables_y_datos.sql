-- Precios editables por cualquier usuario (sin ver costo), datos confirmados con el jefe,
-- y nuevo segmento "Compras por Internet" dentro de courier.

-- ===== 1. Concepto editable por cualquier usuario (solo el precio de venta, nunca el costo) =====
alter table conceptos add column if not exists editable_por_todos boolean not null default false;

update conceptos set editable_por_todos = true
where nombre in ('Trámite aduanal (LCL / aéreo / courier)', 'Courier Plus (por libra, peso real)', 'Entrega Local');

-- ===== 2. Ayudantes: se confirmó diurno Q175 / nocturno Q230; el genérico de Q150 no aplica =====
update conceptos set archivado_at = now()
where nombre = 'Ayudante' and seccion = 'ayudantes' and archivado_at is null;

-- ===== 3. Entrega Local: precio real Q550–650 (se deja Q600 de referencia), editable por cualquiera =====
update conceptos set
  costo = 0, tipo_margen = 'precio_fijo', valor_margen = 600, aplica_recargos = false,
  notas = 'Varía Q550–650 según cliente/distancia. Cualquier usuario puede ajustar el precio final.'
where nombre = 'Entrega Local';

-- ===== 4. Datos nuevos rescatados de facturas reales =====
-- Manejo (courier, Q50 fijo, visto en factura real de Zona Inversiones).
insert into conceptos (nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, aplica_recargos, servicios, orden, notas, activo)
select 'Manejo', 'local', 'gastos_locales', 'GTQ', 'envio', 0, 'precio_fijo', 50, true, false, '{courier}', 15,
       'Visto en factura real (Zona Inversiones, courier).', true
where not exists (select 1 from conceptos where nombre = 'Manejo' and seccion = 'gastos_locales');

-- Transporte terrestre: referencia suelta, sin tarifario formal todavía (falta confirmar con transportista).
insert into conceptos (nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, aplica_recargos, pendiente, servicios, orden, notas, activo)
select 'Recolección Puerto Santo Tomás (referencia)', 'local', 'transporte_local', 'GTQ', 'envio', 0, 'precio_fijo', 400, true, false, true, '{terrestre,maritimo_fcl,maritimo_lcl}', 25,
       'Dato suelto de un audio, sin tarifario formal. Confirmar antes de usar en una cotización real.', true
where not exists (select 1 from conceptos where nombre = 'Recolección Puerto Santo Tomás (referencia)');

insert into conceptos (nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, aplica_recargos, pendiente, servicios, orden, notas, activo)
select 'Camión mediano (referencia)', 'local', 'transporte_local', 'GTQ', 'envio', 0, 'precio_fijo', 1650, true, false, true, '{terrestre,maritimo_fcl,maritimo_lcl}', 26,
       'Rango visto Q1,500–1,800 según distancia. Sin tarifario formal por tipo de camión todavía.', true
where not exists (select 1 from conceptos where nombre = 'Camión mediano (referencia)');

-- ===== 5. Nuevo segmento de courier: Compras por Internet =====
alter table cotizaciones drop constraint if exists cotizaciones_segmento_courier_check;
alter table cotizaciones add constraint cotizaciones_segmento_courier_check
  check (segmento_courier in ('ticket', 'consolidado', 'documentos', 'compras_internet'));

with p as (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, notas)
  select 'TACSA · Compras por internet (comisión)', p.id, 'courier', 'compras_internet', 'Miami', 'Guatemala', 'USD',
    'TACSA compra por el cliente (Amazon, tiendas en línea, etc.). Cobra comisión por tramos del valor de compra; el flete por libra y el seguro van aparte, igual que en courier normal.'
  from p
  where not exists (select 1 from tarifarios where nombre = 'TACSA · Compras por internet (comisión)')
  returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, rango_desde, rango_hasta, tipo_margen, valor_margen, aplica_iva, aplica_recargos, servicios, orden, notas)
select t.id, (select id from proveedores where nombre = 'TACSA Courier & Cargo'), x.nombre, 'internacional', 'compras_internet', 'USD',
       'envio', x.costo, x.desde, x.hasta, 'porcentaje', x.valor_margen, true, x.recargos, '{courier}', x.orden, x.notas
from t, (values
  ('Comisión de compra ($1 – $25)', 1::numeric, 25::numeric, 2.50, 40::numeric, true, 10, 'Comisión TACSA. No incluye flete de traslado, impuestos ni seguro (van aparte).'),
  ('Comisión de compra ($26 – $50)', 26::numeric, 50::numeric, 4.00, 40::numeric, true, 20, 'Comisión TACSA. No incluye flete, impuestos ni seguro.'),
  ('Comisión de compra ($51 – $100)', 51::numeric, 100::numeric, 5.00, 40::numeric, true, 30, 'Comisión TACSA. No incluye flete, impuestos ni seguro.')
) as x(nombre, desde, hasta, costo, valor_margen, recargos, orden, notas)
where not exists (select 1 from conceptos where nombre = x.nombre and seccion = 'compras_internet');

-- Tramo de $101 en adelante: comisión del 6% sobre el valor de compra. La "cantidad" de esta
-- línea debe ponerse igual al valor de la compra en USD (como en un concepto por factura).
-- Se usa "porcentaje" (costo 0.06 × recargos × 40%) en vez de un precio_fijo con tasa decimal,
-- porque la columna valor_margen solo guarda 2 decimales y 0.0945 se truncaba a 0.09.
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, rango_desde, tipo_margen, valor_margen, aplica_iva, aplica_recargos, servicios, orden, notas)
select (select id from tarifarios where nombre = 'TACSA · Compras por internet (comisión)'),
       (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
       'Comisión de compra ($101+, 6% del valor)', 'internacional', 'compras_internet', 'USD', 'factura', 0.06, 101, 'porcentaje', 40, true, true, '{courier}', 40,
       'Escribe en "Cantidad" el valor de la compra en USD. 6% de comisión (costo) + ISR + no domiciliada + 40% de margen = ~9.45% del valor de la compra.'
where not exists (select 1 from conceptos where nombre = 'Comisión de compra ($101+, 6% del valor)');
