-- Asistente de IA (preguntas/consultas): registro de uso para controlar consumo y ver fallbacks.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  proveedor text not null,
  modelo text not null,
  tokens_entrada int not null default 0,
  tokens_salida int not null default 0,
  exito boolean not null,
  tipo_error text,
  latencia_ms int,
  created_at timestamptz not null default now()
);

alter table ai_usage enable row level security;

-- Cada quien registra su propio uso (lo hace el servidor autenticado como ese usuario);
-- solo un admin puede revisar el historial completo.
create policy "ai_usage_insertar_propio" on ai_usage for insert
  with check (user_id = auth.uid());

create policy "ai_usage_lectura_admin" on ai_usage for select
  using (exists (select 1 from perfiles p where p.user_id = auth.uid() and p.rol = 'admin'));
