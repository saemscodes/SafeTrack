/**
 * SafeTrack — Auth Router (Hybrid Search Bar)
 * Spec §13: Client performs shape triage, fires parallel backend check
 * ONLY for shaped inputs. Calendar local search always runs immediately.
 * npub stored/matched as plaintext — never hashed.
 */

const AuthRouter = (() => {
  // ── Config ───────────────────────────────────────────────
  const SUPABASE_URL = window.SUPABASE_URL || '';
  const EDGE_AUTH = `${SUPABASE_URL}/functions/v1/auth-verify`;
  const EDGE_NOSTR = `${SUPABASE_URL}/functions/v1/auth-nostr`;

  // ── Device fingerprint (ephemeral, session-stable) ───────
  const DEVICE_FP_KEY = 'st_device_fp';
  function getDeviceFP() {
    let fp = localStorage.getItem(DEVICE_FP_KEY);
    if (!fp) {
      // Generate a stable device fingerprint from browser entropy
      fp = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(DEVICE_FP_KEY, fp);
    }
    return fp;
  }

  // ── Shape triage (mirrors backend determineShape) ─────────
  function determineShape(input) {
    const t = input.trim();
    if (/^\d{4}$/.test(t)) return 'four_digit';
    if (/^\d{6}$/.test(t)) return 'six_digit';
    if (/^(nsec1|npub1)[a-z0-9]{58,}$/.test(t)) return 'nostr_string';
    if (/^[0-9a-f]{64}$/.test(t)) return 'nostr_string';
    if (/^[0-9a-f]{128}$/.test(t)) return 'nostr_string'; // signatures from challenge flow
    return 'calendar_text';
  }

  // ── Call backend auth verifier ────────────────────────────
  async function callBackend(input) {
    const resp = await fetch(EDGE_AUTH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-FP': getDeviceFP(),
      },
      body: JSON.stringify({ input }),
    });
    return resp.json();
  }

  // ── Nostr: derive public key from stored nsec locally ─────
  // nsec never sent to backend. We sign a server challenge locally.
  async function localNsecSignChallenge(nsecBech32, nonce) {
    // Import noble/secp256k1 for client-side signing
    const { schnorr } = await import('https://esm.sh/@noble/curves@1.2.0/secp256k1');

    // Decode nsec bech32 → private key bytes → hex
    const privKeyHex = bech32Decode(nsecBech32, 'nsec');
    if (!privKeyHex) throw new Error('Invalid nsec');

    // Derive npub from private key
    const pubKeyBytes = schnorr.getPublicKey(privKeyHex);
    const npub = bytesToNpub(pubKeyBytes);

    // Sign SHA256(nonce) with private key
    const msgBytes = new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
    );
    const sig = schnorr.sign(msgBytes, privKeyHex);
    const sigHex = Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');

    // Zero out nsec immediately
    return { npub, sigHex, privKeyHex: null };
  }

  // ── Nostr: request challenge then sign it ─────────────────
  async function initiateNostrLogin(input) {
    // input may be nsec1... or npub1... or 64-char hex pubkey

    let npub = null;
    let privKeyHex = null;
    let hasCustody = false;

    if (input.startsWith('nsec1') || input.startsWith('nsec')) {
      // C1: local key custody — we have the private key exposed here briefly
      hasCustody = true;
      try {
        privKeyHex = bech32Decode(input, 'nsec');
        const { schnorr } = await import('https://esm.sh/@noble/curves@1.2.0/secp256k1');
        const pubBytes = schnorr.getPublicKey(privKeyHex);
        npub = bytesToNpub(pubBytes);
      } catch {
        return { type: 'error', message: 'invalid_nsec' };
      }
    } else if (input.startsWith('npub1') || /^[0-9a-f]{64}$/.test(input)) {
      // C2: NIP-46 or manual npub entry (external signer)
      npub = input;
      hasCustody = false;
    } else {
      return { type: 'calendar_search', results: [] };
    }

    // Request challenge from server
    const challengeResp = await fetch(
      `${EDGE_NOSTR}?action=challenge&npub=${encodeURIComponent(npub)}`,
      { headers: { 'X-Device-FP': getDeviceFP() } }
    );
    const challengeData = await challengeResp.json();
    if (challengeData.type !== 'nostr_challenge') {
      return { type: 'calendar_search', results: [] };
    }
    const nonce = challengeData.nonce;

    if (hasCustody && privKeyHex) {
      // Sign the nonce locally with the private key (never leaves device)
      try {
        const { schnorr } = await import('https://esm.sh/@noble/curves@1.2.0/secp256k1');
        const msgBytes = new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))
        );
        const sig = schnorr.sign(msgBytes, privKeyHex);
        const sigHex = Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('');

        // Zero reference (GC will clean bytes; best effort in JS)
        privKeyHex = null;

        // Send only npub + sig to backend
        const verifyResp = await fetch(`${EDGE_NOSTR}?action=verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-FP': getDeviceFP(),
          },
          body: JSON.stringify({ npub, nonce, sig: sigHex }),
        });
        return verifyResp.json();
      } catch (e) {
        return { type: 'error', message: 'signing_failed' };
      }
    } else {
      // C2: return the challenge so the UI can prompt external signer
      return { type: 'nip46_challenge', npub, nonce };
    }
  }

  // ── Bech32 utilities (minimal, browser-compatible) ────────
  const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const BECH32_CHARSET_MAP = {};
  for (let i = 0; i < BECH32_CHARSET.length; i++) BECH32_CHARSET_MAP[BECH32_CHARSET[i]] = i;

  function bech32Decode(str, expectedHrp) {
    try {
      str = str.toLowerCase();
      const pos = str.lastIndexOf('1');
      if (pos < 1 || pos + 7 > str.length) return null;
      const hrp = str.slice(0, pos);
      if (hrp !== expectedHrp) return null;

      const data = [];
      for (let i = pos + 1; i < str.length; i++) {
        const v = BECH32_CHARSET_MAP[str[i]];
        if (v === undefined) return null;
        data.push(v);
      }

      // Convert 5-bit words to bytes
      const bytes = [];
      let value = 0, bits = 0;
      for (let i = 0; i < data.length - 6; i++) { // strip checksum
        value = (value << 5) | data[i];
        bits += 5;
        while (bits >= 8) {
          bits -= 8;
          bytes.push((value >> bits) & 0xff);
        }
      }
      if (bytes.length !== 32) return null;
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  function bytesToNpub(pubKeyBytes) {
    const words = [];
    let value = 0, bits = 0;
    for (const byte of pubKeyBytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        words.push((value >> bits) & 31);
      }
    }
    if (bits > 0) words.push((value << (5 - bits)) & 31);

    // minimal bech32 encode (no checksum validation needed — display only)
    let result = 'npub1';
    for (const w of words) result += BECH32_CHARSET[w];
    return result;
  }

  // ── Public API ────────────────────────────────────────────
  return {
    determineShape,
    callBackend,
    initiateNostrLogin,
    getDeviceFP,
    bech32Decode,
    bytesToNpub,

    /**
     * handleSubmit — called ONCE when user submits the search bar.
     * Returns auth result OR signals calendar search.
     */
    async handleSubmit(input) {
      const shape = determineShape(input.trim());

      if (shape === 'calendar_text') {
        // Not an auth shape — pure calendar search
        return { type: 'calendar_search', query: input };
      }

      if (shape === 'nostr_string') {
        // Nostr flow: local signing or NIP-46
        return initiateNostrLogin(input.trim());
      }

      // 4-digit or 6-digit: fire backend
      try {
        return await callBackend(input.trim());
      } catch {
        // Network failure — return calendar search to avoid leaking auth attempt
        return { type: 'calendar_search', query: input };
      }
    },

    /**
     * submitNIP46Signature — called after external signer returns the signature
     * for a NIP-46 challenge.
     */
    async submitNIP46Signature(npub, nonce, sigHex) {
      const resp = await fetch(`${EDGE_NOSTR}?action=verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-FP': getDeviceFP(),
        },
        body: JSON.stringify({ npub, nonce, sig: sigHex }),
      });
      return resp.json();
    },

    /**
     * registerNostrAccount — called from onboarding when a new npub user sets up profile
     */
    async registerNostrAccount({ npub, nonce, sig, username, displayName, phone }) {
      const resp = await fetch(`${EDGE_NOSTR}?action=register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-FP': getDeviceFP(),
        },
        body: JSON.stringify({ npub, nonce, sig, username, display_name: displayName, phone }),
      });
      return resp.json();
    },
  };
})();
