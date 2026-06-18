-- ============================================================
-- SYNC MULTI-DEVICE vía Broadcast-from-Database (triggers)
-- Run in Supabase SQL Editor (one-time)
-- ============================================================
-- Reemplaza postgres_changes (CDC) — que crasheaba el servicio Realtime con
-- :queue_timeout — por Broadcast desde la base con triggers. Ventajas:
--   - Atado al COMMIT: todo cambio confirmado se propaga, venga de UI/API/webhook.
--   - Corre por el camino de Broadcast (slot ..._messages_..., que está SANO).
--   - Autorización por org vía RLS sobre realtime.messages, en el SUBSCRIBE
--     (contexto de query normal), así que sí puede usar get_my_org_id() seguro.
--   - Escalable (recomendación oficial de Supabase sobre postgres_changes).
-- ============================================================

-- 1) Sacar las 6 tablas de la publicación de postgres_changes. Ya no usamos CDC;
--    dejarlas ahí mantiene al worker PostgresCdcRls procesándolas y en crash-loop
--    (lo que tenía al tenant unhealthy). El Broadcast NO usa esta publicación.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','ventas','stock_movements','rutas','b2b_orders','clients']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 2) Función de trigger genérica: emite un broadcast PRIVADO al topic de la org
--    'org:<org_id>' con la misma forma que consumía el front (operation/record/old_record).
CREATE OR REPLACE FUNCTION public.broadcast_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org text;
  v_rec jsonb;
  v_old jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.org_id;
    v_old := to_jsonb(OLD);
    v_rec := NULL;
  ELSE
    v_org := NEW.org_id;
    v_rec := to_jsonb(NEW);
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
  END IF;

  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'operation', TG_OP,
      'schema',    TG_TABLE_SCHEMA,
      'table',     TG_TABLE_NAME,
      'record',    v_rec,
      'old_record', v_old
    ),
    'change',            -- event name (el front escucha 'change')
    'org:' || v_org,     -- topic por org
    true                 -- private := true (canal autorizado por RLS)
  );

  RETURN NULL;
END;
$$;

-- 3) Triggers AFTER INSERT/UPDATE/DELETE en las 6 tablas (idempotente).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','ventas','stock_movements','rutas','b2b_orders','clients']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_rt_broadcast ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_rt_broadcast AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      || 'FOR EACH ROW EXECUTE FUNCTION public.broadcast_org_change()', t);
  END LOOP;
END $$;

-- 4) RLS en realtime.messages: un usuario solo RECIBE broadcasts de SU org.
--    Se evalúa en el SUBSCRIBE (query normal) -> get_my_org_id() es seguro y válido.
--    NO usa user_metadata (que es spoofeable): mapea email verificado -> users.org_id.
DROP POLICY IF EXISTS rt_receive_own_org ON realtime.messages;
CREATE POLICY rt_receive_own_org ON realtime.messages
  FOR SELECT TO authenticated
  USING ( (SELECT realtime.topic()) = 'org:' || public.get_my_org_id() );

-- 5) Verificar: 6 triggers creados.
SELECT event_object_table AS tabla, trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trg_rt_broadcast'
ORDER BY event_object_table;
