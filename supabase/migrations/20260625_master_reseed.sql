-- ═══════════════════════════════════════════════════════════════════
-- SafeTrack Master Re-Seed Migration (2026-06-25)
-- Run this once in the Supabase SQL Editor to establish the 3 root
-- identities and all required table structures cleanly.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Heal table structures (safe — uses IF NOT EXISTS / IF NOT EXISTS columns)

-- seed_phrase_recovery (referenced by auth-seed-store)
CREATE TABLE IF NOT EXISTS public.seed_phrase_recovery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    phrase_hash TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    word_count INTEGER NOT NULL DEFAULT 12,
    entropy_fingerprint TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.seed_phrase_recovery ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "seed_phrase_no_client_access" ON public.seed_phrase_recovery USING (FALSE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- device_pins (referenced by auth-seed-store Phase C)
CREATE TABLE IF NOT EXISTS public.device_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    device_fp TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, device_fp)
);
ALTER TABLE public.device_pins ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "device_pins_service_only" ON public.device_pins USING (FALSE);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- pending_otps — heal missing columns from older schema versions
ALTER TABLE IF EXISTS public.pending_otps
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS inviter_id UUID,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 3. Nuke stale identities (cascade will clean device_pins, seed_phrase_recovery, etc.)
DELETE FROM public.users WHERE username IN ('sam_admin', 'mehret_admin', 'root_genesis');

-- 4. Insert clean base identities (fixed UUIDs for traceability)
INSERT INTO public.users (id, username, display_name, invite_quota) VALUES
  ('8c4937be-c80a-488c-9d0e-1f158c1c8801', 'sam_admin',     'Sam (CEKA)',    50),
  ('c2f1ae0c-1bd7-46f1-81b7-dc38b3066d43', 'mehret_admin',  'Mehret',        3),
  ('ef5bc2ea-a086-4b51-9037-bd95df23141b', 'root_genesis',  'Genesis Node',  3)
ON CONFLICT (id) DO UPDATE SET
  username     = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  invite_quota = EXCLUDED.invite_quota;

-- 5. Purge old OTPs for these users (to prevent stale used=true entries)
DELETE FROM public.pending_otps
  WHERE user_id IN (
    '8c4937be-c80a-488c-9d0e-1f158c1c8801',
    'c2f1ae0c-1bd7-46f1-81b7-dc38b3066d43',
    'ef5bc2ea-a086-4b51-9037-bd95df23141b'
  );

-- 6. Insert fresh bcrypt-hashed OTPs
-- Sam code: 210626  |  Mehret code: 101010
-- Genesis login is handled via GENESIS_SECRET env var (not a DB OTP)
INSERT INTO public.pending_otps (user_id, otp_hash, expires_at) VALUES
  ('8c4937be-c80a-488c-9d0e-1f158c1c8801',
   crypt('210626', gen_salt('bf', 10)),
   now() + interval '90 days'),
  ('c2f1ae0c-1bd7-46f1-81b7-dc38b3066d43',
   crypt('101010', gen_salt('bf', 10)),
   now() + interval '90 days');

-- ═══════════════════════════════════════════════════════════════════
-- REMINDER: Set GENESIS_SECRET=999999 in your backend .env and
-- redeploy the auth-verify edge function for the Genesis login.
-- ═══════════════════════════════════════════════════════════════════
