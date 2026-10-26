-- ============================================================================
-- supabase-cabinet.sql
-- EL JEFE DE GABINETE · memoria de LOOPS ABIERTOS.
--
-- Por qué existe: el Jefe de Gabinete (api/cron-jefe-gabinete.js) no te manda una
-- foto nueva cada día y se olvida. RASTREA cosas abiertas (ej. "83 prospectos de
-- Eric sin trabajar", "org callada hace 12 días", "ingreso en $0") y las persigue
-- día a día hasta que se cierran. Para eso necesita MEMORIA: qué vio ayer, hace
-- cuánto que un tema está abierto, y qué se resolvió desde la última corrida.
--
-- REGLA ESTRUCTURAL (anti-spam, misma que el resto de los agentes): el estado de
-- seguimiento vive en ESTA tabla dedicada, NUNCA en una fila que un cliente o
-- Federico muta por otro motivo. Así un loop no se "reinicia" solo y el Jefe nunca
-- repite ni pierde el hilo. El dedup es por `clave` (una por señal detectable).
--
-- Solo se maneja vía service role (api/_cabinet.js). RLS activo sin políticas.
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cabinet_loops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clave estable de dedup: una por señal (ej. 'leads_sin_trabajar:aryes-ltda-6223',
  -- 'org_callada:aryes-ltda-6223', 'ingreso_cero'). Es el ancla de continuidad:
  -- si la misma señal reaparece, se actualiza esta fila en vez de crear otra.
  clave            TEXT NOT NULL UNIQUE,
  -- ingreso | ventas | activacion | retencion | producto | riesgo
  categoria        TEXT NOT NULL,
  titulo           TEXT NOT NULL,
  detalle          TEXT,
  -- 1 baja · 2 media · 3 alta (ordena el brief)
  severidad        SMALLINT NOT NULL DEFAULT 2,
  -- Org afectada (NULL = tema de Pazque como empresa, ej. ingreso_cero).
  org_id           TEXT,
  -- Los números que disparan el loop (para que el brief no invente nada).
  evidencia        JSONB,
  -- abierto | resuelto
  estado           TEXT NOT NULL DEFAULT 'abierto',
  -- Cuándo se vio por PRIMERA vez (no se pisa en updates → de acá sale "hace N días").
  detectado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Última corrida que todavía lo vio abierto.
  ultima_vez_visto TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cuándo dejó de reproducirse (se resolvió). NULL mientras está abierto.
  resuelto_en      TIMESTAMPTZ,
  -- Cuántas corridas seguidas lo vieron (señal de cuán crónico es).
  veces_visto      INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_cabinet_loops_estado   ON cabinet_loops (estado);
CREATE INDEX IF NOT EXISTS idx_cabinet_loops_detectado ON cabinet_loops (detectado_en);

ALTER TABLE cabinet_loops ENABLE ROW LEVEL SECURITY;
-- Sin políticas: RLS activo deniega anon/authenticated. Único camino = service role.

COMMENT ON TABLE cabinet_loops IS
  'Memoria de loops abiertos del Jefe de Gabinete (api/_cabinet.js). Dedup por clave; detectado_en da la antigüedad. Solo service role.';
