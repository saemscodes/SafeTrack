-- SAFE TRACK REPAIR SCRIPT (2026-06-23)
-- RESTORES MISSING IDENTITY TABLES WITHOUT WIPING DATA

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Restore pending_otps (Missing table causing 404 in auth-verify)
CREATE TABLE IF NOT EXISTS public.pending_otps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    otp_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Restore device_pins (Cross-check for Path C)
CREATE TABLE IF NOT EXISTS public.device_pins (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fp text NOT NULL,
    pin_hash text NOT NULL,
    attempt_count integer DEFAULT 0,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, device_fp)
);

-- 4. Restore user_seeds (Hybrid Key Storage)
CREATE TABLE IF NOT EXISTS public.user_seeds (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    entropy_fingerprint text NOT NULL,
    phrase_hash text NOT NULL,
    language text DEFAULT 'en',
    word_count integer DEFAULT 12,
    created_at timestamp with time zone DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.pending_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_seeds ENABLE ROW LEVEL SECURITY;

-- 6. Basic Policies (Allowing the service role / edge functions only for these identity tables)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pending_otps' AND policyname = 'Enable all for service role') THEN
        CREATE POLICY "Enable all for service role" ON public.pending_otps FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'device_pins' AND policyname = 'Enable all for service role') THEN
        CREATE POLICY "Enable all for service role" ON public.device_pins FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_seeds' AND policyname = 'Enable all for service role') THEN
        CREATE POLICY "Enable all for service role" ON public.user_seeds FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 7. Ensure publication exists for Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Add identity tables to realtime for debugging (optional but helpful)
ALTER PUBLICATION supabase_realtime ADD TABLE pending_otps, device_pins;
