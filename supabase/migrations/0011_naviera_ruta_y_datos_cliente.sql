-- La naviera (COSCO, MSC, YML…) tiene su propia columna; antes iba mezclada en "via" junto al tamaño ("COSCO 20GP").
alter table tarifas_ruta add column if not exists naviera text;
comment on column tarifas_ruta.naviera is 'Línea naviera que ofrece la tarifa (COSCO, MSC, YML...). Antes se guardaba mezclada en via.';

-- Datos habituales del cliente que se copian a la cotización al elegirlo.
alter table clientes add column if not exists consignatario text;
alter table clientes add column if not exists direccion text;
comment on column clientes.consignatario is 'Consignatario habitual del cliente: se copia a la cotización al elegirlo.';
comment on column clientes.direccion is 'Dirección de entrega habitual del cliente.';
