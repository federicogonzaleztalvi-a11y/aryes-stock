-- A-2: GPS Tracking tables
CREATE TABLE IF NOT EXISTS aryes_tracking (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL DEFAULT 'aryes',
  lat          NUMERIC(10,7) NOT NULL,
  lng          NUMERIC(10,7) NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario      TEXT,
  ruta_id      TEXT,
  velocidad    NUMERIC(6,2),
  precision_m  NUMERIC(8,2)
);
CREATE TABLE IF NOT EXISTS aryes_tracking_history (
  id           BIGSERIAL PRIMARY KEY,
  driver_id    TEXT NOT NULL,
  org_id       TEXT NOT NULL DEFAULT 'aryes',
  lat          NUMERIC(10,7) NOT NULL,
  lng          NUMERIC(10,7) NOT NULL,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ruta_id      TEXT,
  velocidad    NUMERIC(6,2),
  precision_m  NUMERIC(8,2)
);
CREATE INDEX IF NOT EXISTS idx_tracking_org     ON aryes_tracking(org_id);
CREATE INDEX IF NOT EXISTS idx_tracking_hist    ON aryes_tracking_history(driver_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_hist_org ON aryes_tracking_history(org_id, ts DESC);
ALTER TABLE aryes_tracking         ENABLE ROW LEVEL SECURITY;
ALTER TABLE aryes_tracking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY tracking_org_sel  ON aryes_tracking         FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY tracking_org_all  ON aryes_tracking         FOR ALL    USING (org_id = get_my_org_id());
CREATE POLICY tracking_hist_sel ON aryes_tracking_history FOR SELECT USING (org_id = get_my_org_id());
CREATE POLICY tracking_hist_all ON aryes_tracking_history FOR ALL    USING (org_id = get_my_org_id());
