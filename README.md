# 📅 Calendar — SafeTrack

> **On the surface:** A clean, fast personal calendar app.
> **Underneath:** A conflict-zone-grade personal safety platform.

[![Live](https://img.shields.io/badge/Live-swiftcal.top-02B9FC?style=flat-square)](https://swiftcal.top)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)]()
[![Built with Supabase](https://img.shields.io/badge/Built%20with-Supabase-3ECF8E?style=flat-square)](https://supabase.com)
[![Nostr](https://img.shields.io/badge/Protocol-Nostr-purple?style=flat-square)](https://nostr.com)
[![Part of CEKA](https://img.shields.io/badge/Part%20of-CEKA-orange?style=flat-square)](https://civiceducationkenya.com)

---

## What This Is

SafeTrack was built during the NodeNBO Vibecode challenge in Nairobi on 20th June 2026 by a team of civic activists, Bitcoin enthusiasts & influential voices from Kenya, Ethiopia, Uganda, and beyond — in direct response to documented state-sponsored threats against activists across East Africa and the Horn of Africa.

Governments suppress dissent by monitoring communications and tracking individuals. SafeTrack's answer is an app that **looks like a calendar** to anyone who picks up your phone - but gives trusted contacts your live location, fires a silent SOS, and broadcasts encrypted alerts over the Nostr relay network even when local internet is cut.

This is not a concept. It is live at [swiftcal.top](https://swiftcal.top).

---

## How the Cover Works

When anyone opens the app, they see a fully functional calendar — month view, event creation, colour coding, search. Everything works. There is nothing to find.

The search bar is the hidden entry point. Typing a valid credential (PIN, invitation code, seed phrase, or Nostr npub) and pressing Enter silently authenticates the user and transitions them into SafeTrack. To an observer, it looks like a failed calendar search. The transition is instantaneous and leaves no visible trace.

**Three-tap kill switch:** Triple-tapping the SafeTrack logo in the top bar immediately destroys the local session and returns to the calendar. No data remains on-device.

---

## Core Features

### Silent SOS
Hold the SOS button for 2 seconds. No sound. No screen flash. No visible notification on your device. Your trusted contacts receive a push alert with your live GPS coordinates. The alert is signed with your Nostr keypair and broadcast to the relay pool simultaneously.

### Shake to SOS
Or you might need some discretion that doesn't require you to know where to tap? Just shake your device - even when offline - and your SOS messages will be queued up, ready to fire off at the slightest scent of data! This alert is also signed with your Nostr keypair and broadcast to the relay pool simultaneously as well.

### Live Location Sharing
Share your real-time location with selected contacts or groups. Sharing defaults to OFF on first login - you enable it when you are ready. Contacts see your position on a live map. Turn it off instantly with one toggle to go dark.

### Nostr Relay Broadcast
Every SOS event is signed client-side using your private key, encrypted with NIP-44 to your emergency contacts' public keys, and broadcast in parallel to a geographically distributed relay pool. If local networks are throttled or cut — as documented in Tigray and parts of Uganda — the signed event reaches relays hosted outside the shutdown perimeter.

### SMS Fallback (Zero Data Required)
When the device has no internet but SMS still works, the app compresses the signed Nostr event into a `ST1:`-prefixed payload and offers the user the option to send it as a standard text message to the SafeTrack gateway number. The gateway validates the Nostr signature and rebroadcasts to the relay pool. The encrypted location content is never decrypted at the gateway — blind relay only.

### BLE Tracker Tags
Pair any standard BLE beacon to track physical items — bags, vehicles, documents. No proprietary network required. Works with any beacon broadcasting the standard BLE advertisement format.

### Remote Ping
Request an immediate location update from a contact. Silent on their device. Their app reports position automatically.

### Trust Tree (Vouch System)
New users join by invitation only. Existing users generate single-use invitation codes from inside the Settings panel. Each code is valid until first touch, then starts a 24-hour expiry clock — designed for verbal transmission across areas with intermittent connectivity. The trust tree is stored as an npub ancestry path, making it portable off Supabase and cryptographically verifiable on the Nostr relay network. Trust branches are capped at Generation 5 before Admin re-verification is required.

---

## Architecture

```
┌─────────────────────┐     WebSocket / Supabase Realtime     ┌──────────────────────────────┐
│   Web PWA (Calendar │◄─────────────────────────────────────►│                              │
│   cover + SafeTrack)│                                        │  Supabase Edge Functions     │
└─────────────────────┘                                        │  (Deno/TypeScript)           │
                                                               │                              │
┌─────────────────────┐     REST + Realtime                    │  Supabase Postgres           │
│   iOS (Swift/       │◄─────────────────────────────────────►│  Row Level Security          │
│   SwiftUI)          │                                        │                              │
└─────────────────────┘                                        │  Supabase Auth               │
                                                               │                              │
┌─────────────────────┐     REST + Realtime                    └──────────────────────────────┘
│   Android (Kotlin/  │◄──────────────────────────────────────             │
│   Jetpack Compose)  │                                                     │
└─────────────────────┘                                             SMS Gateway Webhook
                                                                    (Africa's Talking /
          │                                                          Twilio fallback)
          ▼                                                                  │
 Nostr Relay Pool                                                            │
 (Client-side broadcast)                                                     │
 wss://relay.damus.io                                              Supabase Edge Function
 wss://nos.lol                                                     sms-webhook/index.ts
 wss://nostr.wine                                                  (ST1: payload decode
 wss://relay.nostr.band                                             + relay rebroadcast)
 + Emergency fallback pool
 (US / Europe / Asia-Pacific)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend PWA | HTML5 / CSS3 / Vanilla JS |
| iOS Native | Swift / SwiftUI / CoreLocation / CoreBluetooth |
| Android Native | Kotlin / Jetpack Compose / WorkManager |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | Supabase Postgres with RLS |
| Realtime | Supabase Realtime (Postgres Changes) |
| Decentralized Messaging | Nostr Protocol (NIP-01, NIP-44, NIP-46, NIP-65) |
| Maps | Leaflet.js |
| Auth | Nostr keypair (NIP-46) + PIN + BIP39 seed phrase |
| SMS Fallback | Africa's Talking (East Africa) / Twilio (global) |
| Deployment | Vercel (PWA) + Supabase Cloud |
| Domain | swiftcal.top |

---

## Project Structure

```
SafeTrack/
├── web-client/               # PWA — Calendar cover + SafeTrack app
│   ├── index.html            # Calendar UI + stealth auth entry point
│   ├── css/
│   │   ├── main.css
│   │   └── calendar.css
│   ├── js/
│   │   ├── auth-router.js    # PIN / npub / seed phrase / invite routing
│   │   ├── calendar.js       # Fully functional calendar (decoy)
│   │   ├── app.js            # SafeTrack app state + initialisation
│   │   ├── map.js            # Leaflet live location map
│   │   ├── contacts.js       # Contact list + NIP-65 relay discovery
│   │   ├── sos.js            # SOS trigger + Nostr broadcast + offline queue
│   │   ├── nostr-p2p.js      # Nostr relay WebSocket management
│   │   ├── realtime.js       # Supabase Realtime subscriptions
│   │   ├── trackers.js       # BLE tracker tag management
│   │   ├── settings.js       # Ping frequency / privacy / SOS config
│   │   ├── bip39.js          # BIP39 seed phrase (EN / Amharic / Tigrinya)
│   │   ├── avatar-engine.js  # Deterministic local identity avatars
│   │   ├── glass-tour.js     # First-time user guide (post-auth only)
│   │   ├── dock.js           # Bottom navigation
│   │   ├── api.js            # Supabase API wrapper
│   │   └── icons.js          # SVG icon system
│   ├── manifest.json         # PWA manifest (Calendar cover identity)
│   └── sw.js                 # Service Worker (offline-first)
├── supabase/
│   └── functions/
│       ├── auth-nostr/       # Nostr keypair authentication
│       ├── auth-verify/      # PIN + Genesis Key verification
│       ├── sms-webhook/      # ST1: payload decode + relay rebroadcast
│       └── invite-manager/   # Vouch system code generation + quota
├── backend/                  # Legacy Node.js/Express (reference only)
├── ios/SafeTrack/            # Swift native app
│   ├── Services/
│   │   ├── LocationManager.swift   # CoreLocation + background tracking
│   │   └── BLEManager.swift        # CoreBluetooth BLE scanner
│   └── Features/SOS/
│       └── SOSManager.swift        # Silent Alert + hold-to-activate
├── android/                  # Kotlin native app
│   └── .../
│       ├── LocationWorker.kt       # WorkManager + SMS fallback
│       └── SOSManager.kt           # SOS dispatcher + Composable button
├── context/                  # Internal architecture notes
├── vercel.json
├── docker-compose.yml
└── Dockerfile
```

---

## Authentication Model

SafeTrack uses a layered, credential-shaped authentication system. The calendar search bar accepts any of the following:

| Input Shape | Path | Result |
|---|---|---|
| 6-digit number (invitation code) | Invitation | New user PIN setup |
| 4-digit number | PIN login | Existing user session restore |
| 12 or 24 word phrase | BIP39 seed recovery | Full account restore on new device |
| `npub1...` string | Nostr keypair | NIP-46 external signer flow |
| 32-character string | Genesis Key (Admin only) | Root admin bootstrap |
| Any 6-digit demo code | Demo mode | Guided tour (temporary) |
| Anything else | Calendar search | Decoy — no response, no error |

All credentials are validated server-side inside Supabase Edge Functions. Nothing sensitive is evaluated in client-side JavaScript.

---

## Nostr Integration

SafeTrack's Nostr layer provides carrier-independent SOS broadcast — critical when local telecom infrastructure is shut down.

**SOS Keypair:** Each user holds a dedicated SOS Nostr keypair separate from any general Nostr identity. The private key is stored in the device's secure enclave (iOS Keychain / Android Keystore) and never transmitted to the server.

**NIP-44 Encryption:** SOS event content (GPS coordinates, timestamp, alert type) is encrypted to emergency contacts' public keys before signing. Relay operators see a signed event; they cannot read the payload.

**NIP-65 Relay Discovery:** The app fetches each contact's `kind:10002` relay list at setup time and caches it locally. At SOS trigger time, the broadcast targets the relays each contact is actually listening to — not just the default pool.

**Relay Triage Order at Broadcast:**
1. Contact-specific relays (from cached NIP-65 data)
2. Primary relay pool (hardcoded, geographically distributed)
3. Emergency fallback pool (US / Europe / Asia-Pacific)
4. Supabase backend passive receiver
5. Offline queue → SMS fallback

---

## SMS Fallback (ST1: Protocol)

When data is unavailable and SMS still works:

1. The app compresses the signed Nostr event, strips non-essential fields, and encodes it as Base64 with a `ST1:` prefix.
2. Multi-part messages are split as `ST1/1/3:` fragments.
3. The user sends the text to the SafeTrack gateway number.
4. The Supabase Edge Function (`sms-webhook`) receives the inbound SMS, validates the Nostr signature, and rebroadcasts to the relay pool.
5. The gateway sends a confirmation reply: `ST-OK:[event_id]` on success or `ST-FAIL` on failure.
6. The gateway never decrypts the content — blind relay only.

---

## Trust Tree / Vouch System

| Property | Value |
|---|---|
| Default invite quota per user | 3 |
| Code expiry | First-touch triggered — 24h clock starts on first entry attempt |
| Code lifespan before first touch | Indefinite |
| Ancestry storage | npub path e.g. `/npub1-root/npub2-mehret/npub3-colleague` |
| Maximum trust depth | Generation 5 — further invites blocked until Admin re-verification |
| Rate limit | 1 invite generated per 6-hour window per user |
| Branch disable | Graduated: single user / notify invitees / full branch |
| Invite status visible to inviter | Via Contacts pending badge + Map presence |

---

## Database Schema (Key Tables)

```sql
-- Users with Nostr-native ancestry
users (
  id UUID PRIMARY KEY,
  npub TEXT UNIQUE NOT NULL,
  ancestry_path TEXT,          -- npub path for trust tree
  invite_quota INT DEFAULT 3,
  invite_count INT DEFAULT 0,
  sharing_enabled BOOL DEFAULT FALSE,  -- OFF by default for new accounts
  pin_hash TEXT,
  device_fp_hash TEXT,
  created_at TIMESTAMPTZ
)

-- Invitation codes
pending_otps (
  id UUID PRIMARY KEY,
  code_hash TEXT NOT NULL,
  inviter_npub TEXT REFERENCES users(npub),
  first_touched_at TIMESTAMPTZ,        -- NULL until first entry attempt
  expires_at TIMESTAMPTZ,              -- Set to first_touched_at + 24h
  used BOOL DEFAULT FALSE,
  created_at TIMESTAMPTZ
)

-- Device passports (hashed — no plaintext identifiers)
user_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_fp_hash TEXT,
  platform_hash TEXT,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

-- All tables protected by Supabase RLS
-- Users can only read/write their own rows
```

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Edge Functions only — never client-side

# Supabase Vault Secrets (set via supabase secrets set)
GENESIS_SECRET=              # 32-char admin bootstrap key — server-side only
SMS_WEBHOOK_SECRET=          # Inbound SMS webhook token
NOSTR_RELAY_POOL=            # Comma-separated relay WSS URLs
EMERGENCY_RELAY_POOL=        # Fallback relays (out-of-region)

# SMS Gateway
AFRICA_TALKING_API_KEY=      # East Africa inbound/outbound
AFRICA_TALKING_USERNAME=
TWILIO_ACCOUNT_SID=          # Global fallback
TWILIO_AUTH_TOKEN=
SMS_GATEWAY_NUMBER=
```

---

## Deployment

### PWA (Vercel)

```bash
# Connect repo to Vercel
vercel --prod

# Custom domain
# Add A record: @ → 216.198.79.1
# Add CNAME: www → 112a6bbf1edf97a0.vercel-dns-017.com
```

### Supabase Edge Functions

```bash
# Set secrets first
supabase secrets set GENESIS_SECRET=your_32_char_key
supabase secrets set SMS_WEBHOOK_SECRET=your_webhook_token
supabase secrets set NOSTR_RELAY_POOL=wss://relay.damus.io,wss://nos.lol,...

# Deploy all functions
supabase functions deploy auth-nostr
supabase functions deploy auth-verify
supabase functions deploy sms-webhook
supabase functions deploy invite-manager
```

### Webhook URLs

```
Twilio inbound SMS:
https://[SUPABASE_PROJECT_ID].supabase.co/functions/v1/sms-webhook?token=[SMS_WEBHOOK_SECRET]

Africa's Talking inbound SMS:
https://[SUPABASE_PROJECT_ID].supabase.co/functions/v1/sms-webhook?token=[SMS_WEBHOOK_SECRET]
```

---

## Security Notes

- The Genesis Key exists only in Supabase Vault. It is never present in any client-side file, commit, or environment variable exported to Vercel.
- Device metadata is stored as hashes only. No IMEI, no MAC address, no plaintext identifiers.
- SOS private keys are stored in the device's secure enclave. SafeTrack never holds them.
- The `robots.txt` blocks crawling of all JS files containing Nostr or Supabase references.
- The `apple-mobile-web-app-title` is set to "Calendar" — not "SafeTrack" — to maintain cover identity on iOS home screens.
- The Supabase Anon key in `index.html` is intentionally public — it is scoped by RLS policies. Do not replace it with a service role key.

---

## Geographic Context

SafeTrack was designed for and tested against real threat models in:

- **Kenya** — civic activists facing surveillance and detention
- **Ethiopia / Tigray** — documented full telecom shutdowns during conflict
- **Uganda** — activists operating under active monitoring
- **South Sudan / Zimbabwe** — low-infrastructure, high-risk environments

Countries represented by the NodeNBO build team: Kenya, Ethiopia, Uganda, Nigeria, Ireland, South Korea, Zimbabwe, South Sudan.

The SMS fallback exists because Tigray's conflict documented scenarios where data was cut but basic SMS survived. The Nostr relay architecture exists because no SMS infrastructure at all survives a full blackout.

---

## Contributing

This is an open-source project under Civic Education Kenya (CEKA). We welcome contributions from civic technologists, security researchers, and developers working on human rights infrastructure.

Before contributing, please read the security model above. Pull requests that weaken the stealth architecture, expose sensitive metadata, or introduce vendor lock-in to the critical SOS path will not be merged.

Contact: [civiceducationkenya.com](https://civiceducationkenya.com)

---

## Built By

**Civic Education Kenya (CEKA)** — Kenya's open-source civic tech platform.

Initial build team (NodeNBO Vibecode Challenge, Nairobi, June 2026):
Saem (KE) · Mehret (ETH) · Toko (UG) · Shakira (KE) · Lynn

With support and inspiration from the broader NodeNBO community and the Human Rights Foundation.

---

*This project exists because the people who need it most cannot afford for it not to work.*
