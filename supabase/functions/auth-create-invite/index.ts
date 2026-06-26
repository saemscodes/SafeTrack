// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
// @ts-ignore
import { decode } from 'https://deno.land/x/djwt@v2.8/mod.ts';

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

async function verifyJWT(token: string): Promise<string | null> {
  try {
    const [_header, payload, _signature] = decode(token);
    if (!payload || !(payload as any).sub) return null;
    const exp = (payload as any).exp as number;
    if (exp && exp < Math.floor(Date.now() / 1000)) return null;
    return (payload as any).sub as string;
  } catch (err) {
    console.error('JWT Decode Error:', err);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Authenticate the inviter
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const userId = await verifyJWT(token);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // 1. Load inviter profile
  const { data: inviter, error: inviterErr } = await supabase
    .from('users')
    .select('id, invite_quota, invite_count, ancestry_path, npub')
    .eq('id', userId)
    .single();

  if (inviterErr || !inviter) return json({ error: 'User not found' }, 404);

  // 2. Check quota
  if ((inviter.invite_count ?? 0) >= inviter.invite_quota) {
    return json({ error: 'quota_exceeded' }, 403);
  }

  // 3. Check trust depth — max 6 hops from Genesis
  const ancestry = inviter.ancestry_path || '';
  const depth = ancestry === '' ? 0 : ancestry.split('/').filter(Boolean).length;
  if (depth >= 6) {
    return json({ error: 'trust_depth_exceeded' }, 403);
  }

  // 4. Generate 6-digit code and hash it
  const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = bcrypt.hashSync(rawCode, 10);

  // 5. Create a Shadow User — a reserved, unclaimed seat for the invitee.
  //    They will flesh this out during their own Vouch Setup flow.
  const newAncestry = ancestry ? `${ancestry}/${inviter.npub || inviter.id}` : `/${inviter.npub || inviter.id}`;
  const { data: shadowUser, error: shadowErr } = await supabase
    .from('users')
    .insert({
      username: `pending_${rawCode}`,
      display_name: 'Pending User',
      ancestry_path: newAncestry,
      invite_quota: 3,
    })
    .select('id')
    .single();

  if (shadowErr || !shadowUser) {
    console.error('[auth-create-invite] Shadow user creation failed:', shadowErr);
    return json({ error: 'Failed to create invite slot: ' + (shadowErr?.message ?? 'unknown') }, 500);
  }

  // 6. Bind the OTP to the shadow user's seat
  const { error: otpErr } = await supabase
    .from('pending_otps')
    .insert({
      user_id: shadowUser.id,
      inviter_id: inviter.id,
      otp_hash: otpHash,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    });

  if (otpErr) {
    // Rollback shadow user if OTP insert fails
    await supabase.from('users').delete().eq('id', shadowUser.id);
    console.error('[auth-create-invite] OTP insert failed:', otpErr);
    return json({ error: 'Failed to bind invite code: ' + otpErr.message }, 500);
  }

  // 7. Increment inviter's invite_count
  await supabase
    .from('users')
    .update({ invite_count: (inviter.invite_count ?? 0) + 1 })
    .eq('id', inviter.id);

  // 8. Return the raw code — only the inviter ever sees this
  return json({ ok: true, code: rawCode });
});
