-- ============================================================================
-- supabase-brandcfg-select-todos-roles.sql
-- Permite que CUALQUIER usuario autenticado de la org LEA la marca (brandcfg):
-- logo, nombre, color. Genérico: sirve para todas las orgs.
--
-- Qué resuelve:
--   La política original "config_admin" sobre app_config es FOR ALL y solo deja
--   al admin (get_my_role() = 'admin'). Por eso vendedor / operador / contador
--   NO veían el logo de la empresa: su SELECT a app_config devolvía 0 filas.
--
--   Esta política agrega SOLO lectura del row key='brandcfg'. NO expone:
--     - emailcfg (credenciales de email)
--     - cfe_seq_* (contadores de numeración)
--   El admin sigue con acceso total vía la política existente (las permissive
--   policies de Postgres se combinan con OR).
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor y ejecutar.
-- ============================================================================

DROP POLICY IF EXISTS "config_brandcfg_read_all" ON app_config;

CREATE POLICY "config_brandcfg_read_all" ON app_config
  FOR SELECT TO authenticated
  USING (key = 'brandcfg');

-- ============================================================================
-- Verificación (logueado como vendedor/operador desde la app):
--   SELECT key FROM app_config WHERE key = 'brandcfg';
--   -- debe devolver 1 fila (antes devolvía 0 para no-admin)
-- ============================================================================
