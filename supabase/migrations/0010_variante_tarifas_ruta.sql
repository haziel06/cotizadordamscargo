-- Un mismo tramo puede traer varios precios (20GP / 40HQ, escalas de peso): cada uno es una fila y
-- esta columna dice cuál es. Aditiva y opcional: no cambia nada de lo existente.
alter table tarifas_ruta add column if not exists variante text;
comment on column tarifas_ruta.variante is 'Qué precio es cuando un mismo tramo tiene varias columnas: 20GP, 40HQ, escala de peso, etc.';
