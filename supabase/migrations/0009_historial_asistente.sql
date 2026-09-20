-- Historial de conversaciones del asistente: cada quien guarda las suyas, máximo 10 (se recortan al guardar).
create table if not exists ia_conversaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  mensajes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ia_conversaciones_user_idx on ia_conversaciones (user_id, updated_at desc);

alter table ia_conversaciones enable row level security;

create policy "ia_conversaciones_propias" on ia_conversaciones for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
