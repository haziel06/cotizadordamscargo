-- Semilla (spec §6 y §8). Costos ajustados "hacia atrás" para que el caso de prueba
-- de la §10 (Grupo Aliados) dé exactamente $8,200.00 y Q9,750.00. El usuario los corregirá.

insert into conceptos (nombre, categoria, moneda, unidad, costo, tipo_margen, valor_margen, aplica_iva, orden, notas) values
-- Flete internacional (USD)
('Flete Marítimo',                 'internacional','USD','envio', 5227.27, 'porcentaje', 10,     true, 10, 'Costo de ejemplo. Venta de referencia: $5,750.00'),
('Flete Aéreo',                    'internacional','USD','kg',       0.55, 'porcentaje', 50,     true, 20, null),
('BL / Documentación',             'internacional','USD','envio',   75.00, 'monto_fijo', 25,     true, 30, 'Venta de referencia: $100.00'),
('Recolección (Pickup)',           'internacional','USD','envio',  652.17, 'porcentaje', 15,     true, 40, 'Venta de referencia: $750.00'),
('Gastos Locales en Origen',       'internacional','USD','envio', 1454.55, 'monto_fijo', 145.45, true, 50, 'Margen fijo equivalente a 10% para que la venta cierre en $1,600.00 exactos'),
('SED',                            'internacional','USD','envio',   30.00, 'porcentaje', 15,     true, 60, null),
('Seguro de mercadería',           'internacional','USD','envio',    0.00, 'porcentaje', 15,     true, 70, 'Se cotiza aparte cuando el cliente lo pide'),
-- Gastos locales (GTQ)
('Flete Terrestre Puerto a Ciudad','local','GTQ','envio', 4347.83, 'porcentaje', 15,  true, 10, 'Venta de referencia: Q5,000.00'),
('Trámite de Aduana',              'local','GTQ','envio', 2083.33, 'porcentaje', 20,  true, 20, 'Venta de referencia: Q2,500.00'),
('Patrulla',                       'local','GTQ','envio', 1300.00, 'monto_fijo', 200, true, 30, 'Venta de referencia: Q1,500.00'),
('Custodio',                       'local','GTQ','envio',  600.00, 'monto_fijo', 150, true, 40, 'Venta de referencia: Q750.00'),
('Marchamo Electrónico',           'local','GTQ','envio',  120.00, 'monto_fijo', 30,  true, 50, null),
('Servicios Prestados',            'local','GTQ','envio',  300.00, 'precio_fijo',600, true, 60, null),
('Transmisión de Declaración',     'local','GTQ','envio',    0.00, 'precio_fijo',300, true, 70, null),
('Rectificación',                  'local','GTQ','envio',    0.00, 'precio_fijo',475, true, 80, null),
('Entrega Local',                  'local','GTQ','envio',  300.00, 'porcentaje', 20,  true, 90, null),
('Ayudante',                       'local','GTQ','envio',  100.00, 'monto_fijo', 50,  true, 100, null),
('Rayos X',                        'local','GTQ','envio',   15.00, 'monto_fijo', 10,  true, 110, null),
-- Gastos de naviera (USD)
('Gastos Locales en Naviera',            'naviera','USD','envio', 500.00, 'monto_fijo', 50,  true,  10, null),
('Depósito en Garantía (reembolsable)',  'naviera','USD','envio', 500.00, 'precio_fijo',500, false, 20, 'Reembolsable. Sin IVA (pendiente confirmar con la empresa)');

insert into config (clave, valor) values
('empresa', jsonb_build_object(
  'razon_social', 'Agencia Nacional de Carga, S.A.',
  'nombre_comercial', 'Dams Cargo',
  'eslogan', 'Aduanas & Logística',
  'direccion', '12 calle 2-04 zona 9, Edificio Plaza del Sol, 3er Nivel, Oficina 315',
  'ciudad', 'Guatemala, Guatemala. Código Postal 01009',
  'nit', '54820510',
  'pbx', '2225-5400',
  'web', 'www.damscargo.com',
  'correo', 'info@damscargo.com',
  'logo_url', null
)),
('textos_legales', jsonb_build_object(
  'notas', jsonb_build_array(
    'Datos en $ no incluyen IVA',
    'Datos en Q sí incluyen IVA',
    'Se trabaja en base a datos brindados por el cliente',
    'No incluye almacenajes, demoras y sobrepeso',
    'No incluye seguro de mercadería, en caso requerido podemos cotizar',
    'La cotización no es para carga IMO, no aceite, no marca o copia, no baterías, no motores',
    'No incluye pago de impuestos (cliente paga directo a la SAT)',
    'No incluye almacenaje (cliente paga directo a PUERTO o ALMACENADORA)',
    'No incluye estadías ni revisiones por autoridades en puertos',
    'Salidas sujetas a disponibilidad de espacios con la naviera'
  ),
  'cuenta_cliente', jsonb_build_array(
    'Permisos especiales, incluyendo gastos fitosanitarios, cuarentena',
    'Multas por sobrepeso'
  )
)),
('defaults', jsonb_build_object(
  'tipo_cambio', 8.05,
  'dias_vigencia', 15,
  'margen_default', jsonb_build_object('tipo', 'porcentaje', 'valor', 15)
))
on conflict (clave) do nothing;
