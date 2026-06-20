// Supabase Edge Function: auth-nostr
// Handles Path C authentication (Nostr keypair based).
// Sub-path C1: Local key custody — verifies a secp256k1 signature over a server-issued nonce.
// Sub-path C2: NIP-46 — receives signature from external signer that was relayed back.
// On success, mints and returns a Supabase-compatible JWT.
// The raw nsec NEVER enters this function — only npub + signature arrive.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-FP',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function silentFail() {
  return json({ type: 'calendar_search', results: [] });
}

async function mintJWT(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return create(
    { alg: 'HS256', typ: 'JWT' },
    {
      sub: userId,
      role: 'authenticated',
      iss: 'supabase',
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60 * 24 * 7),
    },
    key,
  );
}

// ─── Bech32 npub/nsec decode ─────────────────────────────────
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GENERATOR[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32Decode(bech32Str: string): { hrp: string; words: number[] } | null {
  const str = bech32Str.toLowerCase();
  const pos = str.lastIndexOf('1');
  if (pos < 1 || pos + 7 > str.length || str.length > 90) return null;
  const hrp = str.slice(0, pos);
  const data: number[] = [];
  for (let i = pos + 1; i < str.length; i++) {
    const v = CHARSET.indexOf(str[i]);
    if (v < 0) return null;
    data.push(v);
  }
  if (bech32Polymod([...bech32HrpExpand(hrp), ...data]) !== 1) return null;
  return { hrp, words: data.slice(0, -6) };
}

function wordsToBytes(words: number[]): Uint8Array {
  const bytes: number[] = [];
  let value = 0, bits = 0;
  for (const w of words) {
    value = (value << 5) | w;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

// Decode npub1... → raw 32-byte public key hex
function npubToHex(npub: string): string | null {
  const decoded = bech32Decode(npub);
  if (!decoded || decoded.hrp !== 'npub') return null;
  const bytes = wordsToBytes(decoded.words);
  if (bytes.length !== 32) return null;
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Schnorr signature verification (secp256k1 / NIP-01 style) ─
// Deno does not ship native secp256k1; we use the noble library via esm.sh.
// This verifies that `sig` is a valid Schnorr signature of SHA256(nonce) under `pubkeyHex`.
async function verifySchnorrSignature(
  pubkeyHex: string,
  nonce: string,
  sigHex: string,
): Promise<boolean> {
  try {
    const { schnorr } = await import('https://esm.sh/@noble/curves@1.2.0/secp256k1');
    const msgBytes = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)),
    );
    return schnorr.verify(sigHex, msgBytes, pubkeyHex);
  } catch {
    return false;
  }
}

// ─── ISSUE CHALLENGE ─────────────────────────────────────────
// GET /functions/v1/auth-nostr?action=challenge&npub=npub1...
// Returns a one-time nonce the client signs locally.
async function issueChallenge(npub: string): Promise<Response> {
  if (!npub || (!npub.startsWith('npub1') && !/^[0-9a-f]{64}$/.test(npub))) {
    return silentFail();
  }

  const nonce = crypto.randomUUID() + '-' + Date.now().toString(36);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

  const { error } = await supabase.from('nostr_challenges').insert({
    nonce,
    npub,
    expires_at: expiresAt,
    used: false,
  });

  if (error) return silentFail();

  return json({ type: 'nostr_challenge', nonce, expires_in: 300 });
}

// ─── VERIFY SIGNATURE ────────────────────────────────────────
async function verifySignature(
  npub: string,
  nonce: string,
  sig: string,
): Promise<Response> {
  // Fetch challenge from DB
  const { data: challenge, error } = await supabase
    .from('nostr_challenges')
    .select('id, npub, expires_at, used')
    .eq('nonce', nonce)
    .eq('npub', npub)
    .eq('used', false)
    .maybeSingle();

  if (error || !challenge) return silentFail();
  if (new Date(challenge.expires_at) < new Date()) return silentFail();

  // Mark challenge as used immediately (prevents replay)
  await supabase.from('nostr_challenges').update({ used: true }).eq('id', challenge.id);

  // Derive public key hex from npub
  let pubkeyHex: string | null = null;
  if (npub.startsWith('npub1')) {
    pubkeyHex = npubToHex(npub);
  } else if (/^[0-9a-f]{64}$/.test(npub)) {
    pubkeyHex = npub;
  }

  if (!pubkeyHex) return silentFail();

  // Verify Schnorr signature
  const valid = await verifySchnorrSignature(pubkeyHex, nonce, sig);
  if (!valid) return silentFail();

  // Look up account by npub (plaintext stored)
  const { data: nc } = await supabase
    .from('nostr_credentials')
    .select('user_id')
    .eq('npub', npub)
    .maybeSingle();

  if (!nc) {
    // npub not yet registered — first-time Nostr sign-in, route to onboarding
    return json({ type: 'nostr_onboarding_required', npub });
  }

  const token = await mintJWT(nc.user_id);
  const { data: user } = await supabase.from('users').select('*').eq('id', nc.user_id).single();

  return json({ type: 'auth_success', path: 'nostr', token, user });
}

// ─── REGISTER NEW NOSTR ACCOUNT ─────────────────────────────
async function registerNostrAccount(
  npub: string,
  username: string,
  displayName: string,
  phone: string | null,
  nonce: string,
  sig: string,
): Promise<Response> {
  // Verify signature before any account creation
  const verifyResp = await verifySignature(npub, nonce, sig);
  const verifyBody = await verifyResp.clone().json();

  if (!['auth_success', 'nostr_onboarding_required'].includes(verifyBody.type)) {
    return silentFail(); // signature invalid
  }

  // Check username uniqueness
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
  if (existing) return json({ type: 'error', message: 'username_taken' }, 400);

  // Create user
  const { data: user, error: userError } = await supabase.from('users').insert({
    username,
    display_name: displayName || username,
    phone: phone || null,
    npub,
  }).select().single();

  if (userError || !user) return json({ type: 'error', message: 'registration_failed' }, 500);

  // Link nostr credential
  await supabase.from('nostr_credentials').insert({
    user_id: user.id,
    npub,
    auth_method: 'local',
  });

  // Default settings
  await supabase.from('user_settings').insert({ user_id: user.id });

  const token = await mintJWT(user.id);
  return json({ type: 'auth_success', path: 'nostr_register', token, user });
}

// ─── MAIN HANDLER ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // GET request: issue a challenge for an npub
  if (req.method === 'GET' && action === 'challenge') {
    const npub = url.searchParams.get('npub') ?? '';
    return issueChallenge(npub);
  }

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return silentFail();
  }

  const { input, npub, nonce, sig, username, display_name, phone } = body;

  // POST ?action=verify — verify signature
  if (action === 'verify' && npub && nonce && sig) {
    return verifySignature(npub, nonce, sig);
  }

  // POST ?action=register — first-time Nostr account creation
  if (action === 'register' && npub && nonce && sig && username) {
    return registerNostrAccount(npub, username, display_name ?? '', phone ?? null, nonce, sig);
  }

  // POST with raw input (delegated from auth-verify) — parse and route
  if (input) {
    const trimmed = input.trim();
    if (trimmed.startsWith('npub1') || /^[0-9a-f]{64}$/.test(trimmed)) {
      // Just an npub provided — issue challenge for it
      return issueChallenge(trimmed);
    }
  }

  return silentFail();
});
