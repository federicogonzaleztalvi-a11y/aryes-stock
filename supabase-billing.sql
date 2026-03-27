-- ============================================================
-- BILLING: Add Stripe fields to organizations
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan_name              TEXT NOT NULL DEFAULT 'trial';

-- Set trial for existing trial orgs
UPDATE organizations
SET trial_ends_at = NOW() + INTERVAL '14 days'
WHERE trial_ends_at IS NULL AND subscription_status = 'trial';

-- Aryes is already active (skip trial)
UPDATE organizations
SET subscription_status = 'active',
    plan_name = 'pro',
    trial_ends_at = NULL
WHERE id = 'aryes';

-- Helper: does this org have access?
CREATE OR REPLACE FUNCTION org_has_access(p_org_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id
      AND active = true
      AND (
        subscription_status = 'active'
        OR (subscription_status = 'trial' AND trial_ends_at > NOW())
      )
  );
$$;
