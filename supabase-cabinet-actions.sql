-- supabase-cabinet-actions.sql
-- Cola de acciones del Jefe de Gabinete (aprobación con un clic + auditoría).
--
-- Cada fila es UNA acción concreta que el Jefe propone. Federico la aprueba con un
-- clic desde el email (el `token` es la llave: va solo en su inbox, es imposible de
-- adivinar, un solo uso y vence). La ejecución la hace el servidor por POST, nunca
-- por GET — así ningún escáner/prefetch de mails dispara algo sin querer.
--
-- Solo lee/escribe el service role (igual que cabinet_loops). RLS deniega todo lo demás.

create table if not exists cabinet_actions (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,              -- llave de capacidad (en el email)
  tipo          text not null,                     -- ∈ whitelist del registry (_cabinet-actions.js)
  titulo        text not null,                     -- etiqueta corta (botón del email)
  resumen       text,                              -- qué va a pasar (página de confirmación)
  payload       jsonb not null default '{}'::jsonb,-- parámetros concretos de la acción
  dedup_clave   text,                              -- tipo+target → no duplica la misma propuesta
  loop_clave    text,                              -- loop de cabinet_loops que cierra (opcional)
  estado        text not null default 'propuesta', -- propuesta | ejecutada | descartada | expirada | fallida
  resultado     jsonb,                             -- qué devolvió la ejecución (auditoría)
  created_at    timestamptz not null default now(),
  expira_en     timestamptz,                       -- después de esto no se puede aprobar
  ejecutada_en  timestamptz
);

create index if not exists cabinet_actions_token_idx  on cabinet_actions (token);
create index if not exists cabinet_actions_estado_idx on cabinet_actions (estado);
create index if not exists cabinet_actions_dedup_idx  on cabinet_actions (dedup_clave);

alter table cabinet_actions enable row level security;

-- Snooze de loops: "no me jodas con esto hasta tal fecha" (acción loop_silenciar).
-- El loop sigue ABIERTO (no se pierde), solo deja de aparecer en el parte hasta la fecha.
alter table cabinet_loops add column if not exists silenciado_hasta timestamptz;
