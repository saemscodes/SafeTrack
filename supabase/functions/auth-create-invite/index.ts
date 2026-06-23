// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

import { decode } from 'https://deno.land/x/djwt@v2.8/mod.ts';

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const [header, payload, signature] = decode(token);
    if (!payload || !payload.sub) return null;
    const exp = payload.exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub as string;
  } catch (err) {
    console.error('JWT Decode Error:', err);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const userId = await verifyJWT(token);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // 1. Check invite quota
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('invite_quota, npub')
    .eq('id', userId)
    .single();

  if (userErr || !user) return json({ error: 'User not found' }, 404);
  if (user.invite_quota <= 0) return json({ error: 'quota_exceeded' }, 403);

  // 2. Decrement quota
  await supabase
    .from('users')
    .update({ invite_quota: user.invite_quota - 1 })
    .eq('id', userId);

  // 3. Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // 4. Hash and save
  const otpHash = bcrypt.hashSync(code, 10);
  
  // Need to insert into pending_otps. Note that user_id in pending_otps historically was the target user, but in our Vouch schema it might be the inviter!
  // Wait, in `unified_master_infrastructure` it's `inviter_id`.
  const { error: insertErr } = await supabase
    .from('pending_otps')
    .insert({
      inviter_id: userId,
      inviter_npub: user.npub,
      otp_hash: otpHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Valid 30 days until first touch
    });

  if (insertErr) {
    console.error('Insert OTP Error:', insertErr);
    return json({ error: 'Failed to create invite' }, 500);
  }

  // 5. Return the raw code for the frontend to show the inviter
  return json({ ok: true, code });
});
