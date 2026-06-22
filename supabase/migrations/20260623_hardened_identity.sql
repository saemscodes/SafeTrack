-- SAFE TRACK HARDENED IDENTITY SCHEMA (2026-06-23)
-- IMPLEMENTS ANCESTRY PATHS, TRUST DEPTHS, AND FIRST-TOUCH EXPIRY

-- 1. Extend Users table for Scaling Trust
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS ancestry_path text,           -- Stores npub path: /sam_npub/mehret_npub/...
ADD COLUMN IF NOT EXISTS invite_quota integer DEFAULT 3, -- Max invites a user can generate
ADD COLUMN IF NOT EXISTS invite_count integer DEFAULT 0; -- Count of invites issued

-- Update existing user settings for privacy defaults
ALTER TABLE public.user_settings 
ALTER COLUMN location_sharing_enabled SET DEFAULT false;

-- Ensure all new users start with location sharing OFF
UPDATE public.user_settings SET location_sharing_enabled = false WHERE user_id IN (SELECT id FROM users);

-- 2. Refactor Pending OTPs for First-Touch Expiry
ALTER TABLE public.pending_otps
ADD COLUMN IF NOT EXISTS inviter_npub text,            -- Tracking who issued the code
ADD COLUMN IF NOT EXISTS first_touched_at timestamp with time zone, -- When clock starts
ADD COLUMN IF NOT EXISTS expires_after_touch_interval interval DEFAULT '24 hours'; -- Rolling window

-- 3. Update the Purge Function for structural First-Touch logic
CREATE OR REPLACE FUNCTION public.purge_expired_identities()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Delete unused codes that never got touched and passed their hard expiry
    DELETE FROM public.pending_otps 
    WHERE used = false 
    AND (
        (first_touched_at IS NULL AND expires_at < NOW()) OR
        (first_touched_at IS NOT NULL AND (first_touched_at + expires_after_touch_interval) < NOW())
    );

    -- Standard maintenance
    PERFORM public.purge_old_location_history();
END;
$$;

-- 4. Genesis Key Seed Record (PLACEHOLDER)
-- The real genesis secret is checked server-side in the Edge Function against an Env Var.
-- This just ensures the root user exists.
INSERT INTO public.users (username, display_name, ancestry_path)
VALUES ('root_genesis', 'Genesis Node', '/')
ON CONFLICT (username) DO NOTHING;
