-- ============================================================================
-- supabase-no-controla-stock.sql
-- Flag por-org para distribuidoras que NO controlan inventario.
-- Genérico: cualquier organización puede activarlo. NO está atado a ningún org.
--
-- Problema que resuelve:
--   El RPC create_b2b_order_with_reservations valida available_stock = stock - reservas
--   y lanza 'item_insufficient' si no alcanza. Un producto nuevo entra con stock=0
--   por defecto (ProductForm, ImportTab, ExcelModal, applyExcel todos usan 0) →
--   bloquea TODO pedido que lo incluya. Para una distribuidora wholesale que no
--   trackea inventario, esto rompe el portal cada vez que cargan un producto nuevo.
--
-- Solución:
--   1. Flag organizations.no_controla_stock (BOOLEAN, default false).
--   2. Trigger BEFORE INSERT/UPDATE en products: si el org del producto tiene el
--      flag activo y el stock viene null/0, lo setea a 99999 (invisible al cliente,
--      el portal solo usa stock>0 como gate; nunca muestra el número).
--
-- Seguro de re-correr. Pegar en Supabase SQL Editor.
-- ============================================================================

-- 1. Flag por-org (idempotente)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS no_controla_stock BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.no_controla_stock IS
  'Si true, los productos de este org entran con stock alto automáticamente (distribuidora que no trackea inventario). El trigger trg_default_stock_sin_control lo aplica.';

-- 2. Función del trigger: completa stock alto cuando el org no controla inventario
CREATE OR REPLACE FUNCTION default_stock_sin_control()
RETURNS TRIGGER AS $$
DECLARE
  v_no_control BOOLEAN;
BEGIN
  -- Solo actuamos si el stock viene vacío o en 0 (no pisamos un stock real cargado a mano)
  IF NEW.stock IS NULL OR NEW.stock = 0 THEN
    SELECT o.no_controla_stock INTO v_no_control
    FROM organizations o
    WHERE o.id = NEW.org_id;

    IF COALESCE(v_no_control, false) THEN
      NEW.stock := 99999;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger en products (BEFORE INSERT OR UPDATE de stock)
DROP TRIGGER IF EXISTS trg_default_stock_sin_control ON products;
CREATE TRIGGER trg_default_stock_sin_control
  BEFORE INSERT OR UPDATE OF stock ON products
  FOR EACH ROW
  EXECUTE FUNCTION default_stock_sin_control();

-- 4. Backfill: poner stock alto a los productos YA existentes de orgs que activen el flag.
--    (Corre una vez después de activar el flag para cada distribuidora.)
--    Ejemplo para activar una org + backfillear sus productos:
--
--    UPDATE organizations SET no_controla_stock = true WHERE id = '<ORG_ID>';
--    UPDATE products SET stock = 99999
--      WHERE org_id = '<ORG_ID>' AND (stock IS NULL OR stock = 0);
--
-- ============================================================================
-- Verificación:
--   SELECT id, name, no_controla_stock FROM organizations;
--   -- Probar: insertar un producto con stock 0 en un org con el flag → debe quedar 99999
-- ============================================================================
