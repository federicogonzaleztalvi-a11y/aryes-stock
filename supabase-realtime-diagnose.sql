-- Diagnóstico de replicación Realtime — UNA sola consulta, una sola fila.
-- Pegame el resultado completo.
SELECT
  current_setting('wal_level') AS wal_level,
  (SELECT json_agg(row_to_json(s)) FROM (
     SELECT slot_name, plugin, slot_type, active,
            restart_lsn::text, confirmed_flush_lsn::text
     FROM pg_replication_slots
   ) s) AS slots,
  (SELECT json_agg(row_to_json(p)) FROM (
     SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete, pubtruncate
     FROM pg_publication
   ) p) AS publications;
