-- Semilla Fase 2: proveedores reales, tarifarios con vigencia, rutas LCL de Charter Link,
-- tarifas de TACSA (Miami), conceptos propios nuevos y notas con formato.
-- Costos = precio de proveedor. Márgenes = los que la oficina usa hoy (editables).

-- Proveedores
insert into proveedores (nombre, tipo, pais, moneda_default, notas) values
('Charter Link Logistics', 'agente_origen', 'China', 'USD', 'LCL Asia y Europa. Tarifario quincenal (aplica fecha de zarpe).'),
('Pier 17', 'agente_origen', null, 'USD', 'Marítimo. Tarifario pendiente de cargar.'),
('PCS', 'agente_origen', null, 'USD', 'Marítimo. Tarifario pendiente de cargar.'),
('TACSA Courier & Cargo', 'courier', 'Estados Unidos', 'USD', 'Miami: aéreo consolidado, courier, marítimo consolidado, entrega a domicilio.')
on conflict do nothing;

-- Tarifario propio para lo que ya existía (conceptos sembrados en la v1)
with t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, moneda, notas)
  values ('Tarifas base Dams Cargo', null, null, 'gastos_locales', 'GTQ', 'Servicios propios y gastos locales estándar.')
  returning id
)
update conceptos c set tarifario_id = t.id from t where c.tarifario_id is null and c.categoria = 'local';

with t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, moneda, notas)
  values ('Flete marítimo FCL de referencia', null, 'maritimo_fcl', 'flete_maritimo', 'USD', 'Costos de ejemplo de la cotización Grupo Aliados. Reemplazar con el tarifario real del proveedor.')
  returning id
)
update conceptos c set tarifario_id = t.id, aplica_recargos = false from t where c.tarifario_id is null and c.categoria = 'internacional';

with t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, moneda, notas)
  values ('Gastos de naviera de referencia', null, null, 'naviera', 'USD', null)
  returning id
)
update conceptos c set tarifario_id = t.id from t where c.tarifario_id is null and c.categoria = 'naviera';

-- Conceptos propios nuevos (precio de venta fijo: son servicios de Dams Cargo, sin proveedor)
with t as (select id from tarifarios where nombre = 'Tarifas base Dams Cargo' limit 1)
insert into conceptos (tarifario_id, nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, orden, notas, pendiente)
select t.id, x.nombre, 'local', x.seccion, 'GTQ', x.unidad::unidad_concepto, x.costo, x.tipo_margen::tipo_margen, x.valor, true, x.orden, x.notas, x.pendiente from t, (values
  ('Trámite aduanal (LCL / aéreo / courier)', 'documentacion', 'envio', 0, 'precio_fijo', 750, 15, 'Servicio propio. Q700–800 según el caso; ajustar en la cotización.', false),
  ('Duca de traslado', 'documentacion', 'envio', 0, 'precio_fijo', 675, 20, 'Según cotización CORPOMARCAS.', false),
  ('Elaboración de TLC (tratado de libre comercio)', 'documentacion', 'envio', 0, 'precio_fijo', 350, 25, 'Servicio propio.', false),
  ('Gastos locales (consolidado)', 'gastos_locales', 'envio', 0, 'precio_fijo', 1600, 5, 'Paquete de gastos locales para LCL, según cotización CORPOMARCAS.', false),
  ('Ayudante diurno', 'ayudantes', 'envio', 0, 'precio_fijo', 175, 10, 'Q175 según nota de cotizaciones anteriores. Confirmar.', false),
  ('Ayudante nocturno', 'ayudantes', 'envio', 0, 'precio_fijo', 0, 20, 'Falta monto.', true),
  ('Ayudante horas hábiles', 'ayudantes', 'envio', 0, 'precio_fijo', 0, 30, 'Falta monto.', true)
) as x(nombre, seccion, unidad, costo, tipo_margen, valor, orden, notas, pendiente);

-- Reclasificar conceptos existentes en secciones más claras
update conceptos set seccion = 'seguridad' where nombre in ('Patrulla', 'Custodio') and archivado_at is null;
update conceptos set seccion = 'ayudantes' where nombre = 'Ayudante' and archivado_at is null;
update conceptos set seccion = 'documentacion' where nombre in ('Transmisión de Declaración', 'Rectificación', 'Trámite de Aduana') and archivado_at is null;
update conceptos set nombre = 'Trámite de Aduana (FCL)' where nombre = 'Trámite de Aduana';
update conceptos set seccion = 'transporte_local' where nombre in ('Flete Terrestre Puerto a Ciudad', 'Entrega Local') and archivado_at is null;
update conceptos set seccion = 'gastos_origen' where nombre in ('Recolección (Pickup)', 'Gastos Locales en Origen', 'SED') and archivado_at is null;
update conceptos set seccion = 'flete_aereo' where nombre = 'Flete Aéreo' and archivado_at is null;

-- ===== TACSA (Miami) =====
-- Aéreo consolidado: tarifa por libra con mínimo. Venta real: Priority $2.10 (40%), Reservada $1.95.
with p as (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, notas)
  select 'TACSA · Aéreo consolidado Miami → Guatemala', p.id, 'aereo', 'flete_aereo', 'Miami', 'Guatemala', 'USD', '2025-02-01',
    'Tarifa por libra incluye fuel surcharge y security fee. No incluye IVA. Se cobra el mayor entre peso real y volumen. Facturas > $2,500 aplican SED/AES $25. Seguro 1.5% CIF. Requiere código de importador SAT.'
  from p returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, minimo, tipo_margen, valor_margen, aplica_recargos, aplica_iva, orden, notas)
select t.id, (select id from proveedores where nombre = 'TACSA Courier & Cargo'), x.nombre, 'internacional', 'flete_aereo', 'USD', x.unidad::unidad_concepto, x.costo, x.minimo, x.tipo_margen::tipo_margen, x.valor, x.recargos, true, x.orden, x.notas from t, (values
  ('Flete aéreo Priority (por libra)', 'libra', 1.35, 175, 'porcentaje', 40, true, 10, 'Costo $1.35/lb, mínimo 130 lb ($175). Venta oficina: $2.10/lb, mín $275. Sale todos los días.'),
  ('Flete aéreo Reservada (por libra)', 'libra', 1.20, 150, 'porcentaje', 40, true, 20, 'Costo $1.20/lb, mínimo 125 lb ($150). Venta oficina: $1.95/lb, mín $250. Martes a viernes; cierre de guía miércoles antes de 14:45 hora Guatemala.'),
  ('Corte de guía', 'guia', 30, null, 'porcentaje', 40, true, 30, null),
  ('SED / AES (facturas > $2,500)', 'factura', 25, null, 'porcentaje', 0, true, 40, 'Solo cuando la factura supera $2,500.'),
  ('Pickup en Miami', 'envio', 0, null, 'porcentaje', 40, true, 50, 'Según tarifario TACSA / distancia. Falta monto base.')
) as x(nombre, unidad, costo, minimo, tipo_margen, valor, recargos, orden, notas);
update conceptos set pendiente = true where nombre = 'Pickup en Miami';

-- Courier: peso real por libra. Venta real: $3.75 (Courier Plus), $3.50 (express).
with p as (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, notas)
  select 'TACSA · Courier Miami → Guatemala', p.id, 'courier', 'courier', 'Miami', 'Guatemala', 'USD', '2025-02-01',
    'Aplica para facturas menores a $1,000 CIF. Mercadería voluminosa: cotización especial. Seguro 1.5% CIF. Si aduana no acepta courier pasa a póliza mayor ($45 + IVA + Combex + impuestos, entrega en 48 h).'
  from p returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, minimo, tipo_margen, valor_margen, aplica_recargos, aplica_iva, orden, notas)
select t.id, (select id from proveedores where nombre = 'TACSA Courier & Cargo'), x.nombre, 'internacional', 'courier', 'USD', x.unidad::unidad_concepto, x.costo, x.minimo, 'porcentaje', x.valor, true, true, x.orden, x.notas from t, (values
  ('Courier Plus (por libra, peso real)', 'libra', 2.30, null, 45, 10, 'Venta oficina: $3.75/lb. Todos los días.'),
  ('Carga express aérea (por libra)', 'libra', 2.15, 172, 45, 20, 'Mínimo 80 lb. Venta oficina: $3.50/lb.'),
  ('Coordinación, desconsolidación y almacenaje (por guía)', 'guia', 2.50, null, 40, 30, 'Cobro único por guía + IVA.'),
  ('SED / AES (facturas > $2,500)', 'factura', 25, null, 0, 40, null)
) as x(nombre, unidad, costo, minimo, valor, orden, notas);

-- Marítimo consolidado desde Miami: gastos en Miami (USD) y en Guatemala (USD, cobrados por TACSA)
with p as (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, notas)
  select 'TACSA · Marítimo consolidado Miami → Guatemala', p.id, 'maritimo_lcl', 'flete_maritimo', 'Miami', 'Guatemala', 'USD', '2025-02-01',
    'Mínimo $250 por envío. Tránsito 10–15 días. Sobredimensión +19% sobre el flete. Seguro 1.5% CIF. No incluye IVA.'
  from p returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, minimo, tipo_margen, valor_margen, aplica_recargos, aplica_iva, orden, notas)
select t.id, (select id from proveedores where nombre = 'TACSA Courier & Cargo'), x.nombre, x.categoria::categoria_concepto, x.seccion, 'USD', x.unidad::unidad_concepto, x.costo, x.minimo, 'porcentaje', x.valor, true, true, x.orden, x.notas from t, (values
  ('Flete consolidado por libra real', 'internacional', 'flete_maritimo', 'libra', 0.20, 250, 40, 10, 'Se cobra lo mayor entre libra real ($0.20) y pie cúbico ($2.50). Mínimo $250.'),
  ('Flete consolidado por pie cúbico', 'internacional', 'flete_maritimo', 'pie_cubico', 2.50, 250, 40, 11, 'Alternativa al cobro por libra.'),
  ('Documentación (Miami)', 'internacional', 'gastos_origen', 'envio', 95, null, 40, 20, null),
  ('Bunker (por pie cúbico)', 'internacional', 'gastos_origen', 'pie_cubico', 0.05, 50, 40, 30, 'Mínimo $50.'),
  ('BL (Miami)', 'internacional', 'gastos_origen', 'envio', 85, null, 40, 40, null),
  ('EFAF (por pie cúbico)', 'internacional', 'gastos_origen', 'pie_cubico', 0.10, 30, 40, 50, 'Mínimo $30.'),
  ('SED (facturas > $2,500)', 'internacional', 'gastos_origen', 'factura', 25, null, 0, 60, null),
  ('Solas', 'internacional', 'gastos_origen', 'envio', 20, null, 40, 70, null),
  ('DA (Guatemala)', 'naviera', 'naviera', 'envio', 95, null, 40, 10, 'Gasto en Guatemala cobrado por TACSA.'),
  ('DI opcional (Guatemala)', 'naviera', 'naviera', 'envio', 45, null, 40, 20, null),
  ('Revisión, descarga y custodio (Guatemala)', 'naviera', 'naviera', 'envio', 75, null, 40, 30, null),
  ('Requerimiento de partidas (Guatemala)', 'naviera', 'naviera', 'envio', 15, null, 40, 40, null)
) as x(nombre, categoria, seccion, unidad, costo, minimo, valor, orden, notas);

-- Entrega a domicilio perímetro capitalino (TACSA), por rango de libras, USD sin IVA
with p as (select id from proveedores where nombre = 'TACSA Courier & Cargo'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, notas)
  select 'TACSA · Entrega a domicilio perímetro capitalino', p.id, null, 'entrega_domicilio', 'Guatemala', 'Guatemala', 'USD', '2025-02-01',
    'Sujeto a pesos y medidas. No incluye IVA. Adicional cuadrilla si es necesario. Arriba de 1,250 lb tarifa especial.'
  from p returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, rango_desde, rango_hasta, tipo_margen, valor_margen, aplica_recargos, aplica_iva, orden)
select t.id, (select id from proveedores where nombre = 'TACSA Courier & Cargo'), x.nombre, 'local', 'entrega_domicilio', 'USD', 'envio', x.costo, x.d, x.h, 'porcentaje', 40, true, true, x.orden from t, (values
  ('Entrega a domicilio 133–300 lb', 15, 133, 300, 10),
  ('Entrega a domicilio 301–450 lb', 20, 301, 450, 20),
  ('Entrega a domicilio 451–650 lb', 25, 451, 650, 30),
  ('Entrega a domicilio 651–850 lb', 32, 651, 850, 40),
  ('Entrega a domicilio 851–1,050 lb', 38, 851, 1050, 50),
  ('Entrega a domicilio 1,051–1,250 lb', 45, 1051, 1250, 60)
) as x(nombre, costo, d, h, orden);

-- ===== Charter Link · LCL Asia (vigencia 15–30 sep 2026) =====
with p as (select id from proveedores where nombre = 'Charter Link Logistics'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, vigencia_hasta, notas)
  select 'Charter Link · LCL Asia/Europa → Guatemala (15–30 sep 2026)', p.id, 'maritimo_lcl', 'flete_maritimo', 'Asia / Europa', 'Guatemala (CFS ALPASA)', 'USD', '2026-09-15', '2026-09-30',
    'Costo por CBM, CY origen a CFS destino (ALPASA). Aplica fecha de zarpe. Carga general, no IMO. Máx. 25 CBM y 8 t por envío; bulto máx. 2,000 kg. Gastos en destino Asia/Chile: Q950/BL handling + Q120/BL marchamo + Q15/CBM rayos X. Europa: Q950/BL + Q120/BL. Sin seguro.'
  from p returning id
)
insert into tarifas_ruta (tarifario_id, pais, origen, via, costo, unidad, transito, tipo_margen, valor_margen, aplica_recargos)
select t.id, x.pais, x.origen, x.via, x.costo, 'cbm', x.transito, 'porcentaje', 20, true from t, (values
  ('Italia','Milan','Direct',95,'27'),('España','Barcelona','Direct',105,'30'),('Chile','San Antonio','San Jose, CR',100,'31'),
  ('China','Shanghai','Direct',135,'30-35'),('China','Ningbo','Direct',135,'30-35'),('China','Shenzhen','Direct',135,'30-35'),
  ('China','Hong Kong','Direct',135,'30-35'),('China','Qingdao','Direct',135,'30-35'),('China','Guangzhou','Indirect',145,'30-35'),
  ('China','Xiamen','Indirect',145,'30-35'),('Taiwan','Keelung','Hong Kong',155,'30-35'),('Korea','Busan','Direct',135,'30-35'),
  ('India','Nhava Sheva','Direct',150,'55-65'),('Viet Nam','Danang','Hong Kong',170,'50'),('Viet Nam','Haiphong','Hong Kong',155,'50'),
  ('Viet Nam','Hochiminh','Hong Kong',155,'50'),('Taiwan','Taichung','Hong Kong',155,'47'),('Taiwan','Kaohsiung','Hong Kong',155,'47'),
  ('China','Dalian','Busan',160,'40-45'),('China','Dongguan','Hong Kong',130,'40-45'),('China','Fuzhou','Hong Kong',160,'40-45'),
  ('China','Huangpu (Guangzhou)','Hong Kong',135,'40-45'),('China','Jiangmen (Gaosha)','Hong Kong',145,'40-45'),('China','Sanshan','Hong Kong',145,'40-45'),
  ('China','Shantou','Hong Kong',150,'40-45'),('China','Shunde (Rongqi / Foshan)','Hong Kong',145,'40-45'),('China','Xingang / Tianjin','Busan',160,'40-45'),
  ('China','Zhongshan / Xiaolan','Hong Kong',145,'40-45'),('China','Zhuhai (Jiuzhou)','Hong Kong',145,'40-45'),
  ('Japón','Hakata','Busan',180,'40-45'),('Japón','Kobe','Busan',145,'40-45'),('Japón','Moji','Busan',185,'40-45'),('Japón','Nagoya','Busan',145,'40-45'),
  ('Japón','Naha','Busan',220,'40-45'),('Japón','Osaka','Busan',145,'40-45'),('Japón','Sendai','Busan',215,'40-45'),('Japón','Tokyo','Busan',145,'40-45'),('Japón','Yokohama','Busan',145,'40-45'),
  ('India','Ahmedabad','Nhava Sheva & Busan',210,'65-75'),('India','Bangalore','Chennai & Busan',199,'65-75'),('India','Baroda','Nhava Sheva & Busan',205,'65-75'),
  ('India','Calcutta','Busan',185,'65-75'),('India','Cape Town','Singapore & Busan',270,'65-75'),('India','Chennai','Busan',185,'65-75'),
  ('India','Chittagong','Busan',200,'65-75'),('India','Cochin','Singapore & Busan',215,'65-75'),('India','Coimbatore','Chennai & Hong Kong',215,'55-60'),
  ('India','Colombo','Busan',195,'55-60'),('India','Hyderabad','Nhava Sheva & Busan',205,'55-60'),('India','Jaipur','Nhava Sheva & Busan',225,'55-60'),
  ('India','Jodhpur','Nhava Sheva & Busan',215,'55-60'),('India','Ludhiana','Nhava Sheva & Busan',235,'55-60'),('India','New Delhi','Nhava Sheva & Busan',160,'55-60'),
  ('India','Tuticorin','Busan',195,'65-70'),('Thailand','Bangkok','Busan',175,'65-70'),
  ('Philippines','Cebu','Hong Kong',185,'45'),('Philippines','Manila (North/South)','Hong Kong',180,'45'),
  ('Malaysia','Pasir Gudang','Port Klang & Busan',205,'50'),('Malaysia','Penang','Port Klang & Busan',180,'50'),('Malaysia','Port Klang','Busan',180,'50'),
  ('Cambodia','Phnom Penh','Hong Kong',180,'55'),('Indonesia','Jakarta','Busan',180,'55'),('Indonesia','Semarang','Busan',185,'55'),('Indonesia','Surabaya','Busan',185,'55'),
  ('Singapore','Singapore','Busan',180,'55'),('Birmania','Yangon','Hong Kong',215,'55'),('Turkey','Istambul','Hong Kong',180,'60-65'),('Turkey','Istambul','Barcelona',185,'60-65'),
  ('Pakistan','Karachi','Hong Kong',175,'55-60'),
  ('Australia','Adelaide','Singapore & Hong Kong',240,'65-70'),('Australia','Auckland','Singapore & Hong Kong',240,'65-70'),('Australia','Brisbane','Singapore & Hong Kong',240,'65-70'),
  ('Australia','Fremantle','Singapore & Hong Kong',240,'65-70'),('Australia','Melbourne','Singapore & Hong Kong',240,'65-70'),('Australia','Sydney','Singapore & Hong Kong',240,'65-70')
) as x(pais, origen, via, costo, transito);

-- Gastos en destino que Charter Link cobra en Q (por BL / por CBM)
with p as (select id from proveedores where nombre = 'Charter Link Logistics'),
t as (
  insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, vigencia_desde, vigencia_hasta, notas)
  select 'Charter Link · Gastos en destino (Guatemala)', p.id, 'maritimo_lcl', 'naviera', 'Guatemala', 'Guatemala', 'GTQ', '2026-09-15', '2026-09-30', 'Se cobran en destino por BL y por CBM.'
  from p returning id
)
insert into conceptos (tarifario_id, proveedor_id, nombre, categoria, seccion, moneda, unidad, costo, tipo_margen, valor_margen, aplica_recargos, aplica_iva, orden, notas)
select t.id, (select id from proveedores where nombre = 'Charter Link Logistics'), x.nombre, 'local', 'naviera', 'GTQ', x.unidad::unidad_concepto, x.costo, 'porcentaje', 15, false, true, x.orden, x.notas from t, (values
  ('Handling en destino (por BL)', 'envio', 950, 10, null),
  ('Marchamo electrónico (por BL)', 'envio', 120, 20, null),
  ('Revisión intrusiva / rayos X (por CBM)', 'cbm', 15, 30, 'Solo Asia y Chile.')
) as x(nombre, unidad, costo, orden, notas);

-- Tarifarios vacíos de los otros dos proveedores marítimos (listos para cargar)
insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, notas)
select 'Pier 17 · Marítimo (pendiente de cargar)', id, 'maritimo_lcl', 'flete_maritimo', null, 'Guatemala', 'USD', 'Cargar tarifario cuando la empresa lo envíe.' from proveedores where nombre = 'Pier 17';
insert into tarifarios (nombre, proveedor_id, servicio, seccion, origen, destino, moneda, notas)
select 'PCS · Marítimo (pendiente de cargar)', id, 'maritimo_lcl', 'flete_maritimo', null, 'Guatemala', 'USD', 'Cargar tarifario cuando la empresa lo envíe.' from proveedores where nombre = 'PCS';

-- Notas estándar con formato ligero (**negrita**, __subrayado__, ==resaltado==), según la cotización real
update config set valor = jsonb_build_object(
  'notas', jsonb_build_array(
    'Datos en $ no incluyen IVA',
    'Datos en Q sí incluyen IVA',
    'Se trabaja en base a datos brindados por el cliente',
    'Tarifa aplica para carga general',
    'La carga cuando viene en pallet debe de venir fumigada, en caso contrario se realiza cobro',
    '==**No incluye seguro de mercadería, en caso requerido podemos cotizar (0.80% SOBRE VALOR FOB + FLETE / MÍNIMO $75.00)**==',
    '**La cotización no es para carga IMO, no aceite, no marca o copia, no baterías, no motores.**',
    'No incluye pago de impuestos (cliente paga directo a la SAT)',
    'No incluye almacenaje (cliente paga directo a PUERTO o ALMACENADORA)',
    'No incluye ayudante (costo por ayudante ya facturado Q175.00)',
    'No incluye estadías, rayos X ni revisiones por autoridades en puertos',
    'No incluye gastos en origen',
    'No incluye entrega local, se cotiza por evento',
    'Salidas sujetas a disponibilidad de espacios con la naviera',
    'No incluye estadía, MAGA, DIPAFRONT, UCC, DAIA o selectivo rojo'
  ),
  'cuenta_cliente', jsonb_build_array(
    'Permisos especiales, incluyendo gastos fitosanitarios, cuarentena',
    'Multas por sobrepeso'
  )
) where clave = 'textos_legales';
