-- ============================================================
-- REMEDIATION: OTP brute-force protection
-- Audit finding: otp_sessions had no attempt counter or lockout.
-- A 4-digit OTP (9000 combinations) is crackable in seconds
-- with parallel requests and no throttle.
--
-- Fix: add failed_attempts + locked columns.
-- After 5 wrong attempts the session is locked permanently.
-- Safe to re-run (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE otp_sessions
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE otp_sessions
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_otp_sessions_tel_active
  ON otp_sessions (tel, used, locked, expires_at DESC);
