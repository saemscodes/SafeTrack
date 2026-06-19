# SafeTrack — Personal Safety & Location Tracking App

A full-stack personal safety platform with live location sharing, silent SOS alerts, BLE tracker tag support, SMS offline fallback, and native iOS/Android implementations.

## Project Structure

```
SafeTrack/
├── backend/          # Node.js / Express / PostgreSQL API
├── web-client/       # PWA Dashboard (HTML/CSS/JS)
├── ios/              # Swift/SwiftUI native app
├── android/          # Kotlin/Jetpack Compose native app
├── docker-compose.yml
└── Dockerfile
```

## Quick Start (Backend + Web Client)

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ (or Docker)

### 1. Start PostgreSQL (Docker)
```bash
docker-compose up postgres -d
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT secrets
```

### 3. Run Database Migrations
```bash
cd backend
npm run db:push
```
> Or with migrations: `npm run db:migrate`

### 4. Start Backend
```bash
cd backend
npm run dev
```

Open **http://localhost:4000** — the web client is served from this port.

---

## API Reference

Base URL: `http://localhost:4000/api/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | ❌ | Create account |
| POST | `/auth/login` | ❌ | Get JWT tokens |
| POST | `/auth/refresh` | ❌ | Rotate refresh token |
| GET | `/users/me` | ✅ | Own profile |
| GET | `/users/search?q=` | ✅ | Find users |
| GET | `/contacts` | ✅ | List contacts |
| POST | `/contacts/request` | ✅ | Send request |
| PUT | `/contacts/:id/accept` | ✅ | Accept request |
| DELETE | `/contacts/:id` | ✅ | Revoke link |
| POST | `/contacts/groups` | ✅ | Create group |
| POST | `/location/update` | ✅ | Push location |
| GET | `/location/current/:userId` | ✅ | Last known location |
| GET | `/location/history/:userId` | ✅ | Location trail |
| GET | `/location/watchers` | ✅ | Who sees my location |
| POST | `/sos/trigger` | ✅ | Fire SOS alert |
| PUT | `/sos/:id/ack` | ✅ | Acknowledge SOS |
| GET | `/sos/events` | ✅ | My SOS events |
| GET | `/sos/inbox` | ✅ | Received alerts |
| GET | `/trackers` | ✅ | List BLE tags |
| POST | `/trackers` | ✅ | Pair BLE tag |
| DELETE | `/trackers/:id` | ✅ | Unpair tag |
| POST | `/pings/request` | ✅ | Remote force-report |
| GET | `/settings` | ✅ | Get settings |
| PUT | `/settings` | ✅ | Update settings |
| POST | `/webhook/sms/inbound` | 🔑 | SMS fallback inbound |

## SMS Fallback Format

```
LOC,<userId>,<lat>,<lng>,<accuracy>,<batteryPct>,<timestamp_ms>
Example: LOC,abc-123,1.2345,-36.7890,15.0,87,1718800000000
```

## WebSocket Events (Socket.IO)

| Event | Direction | Payload |
|-------|-----------|---------|
| `location:update` | Server→Client | `{userId, lat, lng, accuracy, timestamp}` |
| `sos:alert` | Server→Client | `{eventId, triggeredById, mode, lat, lng}` |
| `sos:ack` | Server→Client | `{eventId, byUserId, status, ackMessage}` |
| `contact:request` | Server→Client | `{linkId, fromUserId}` |
| `ping:forced` | Server→Client | `{pingId, fromUserId}` |

## Native Mobile

### iOS (Swift/SwiftUI)
- `ios/SafeTrack/Services/LocationManager.swift` — CoreLocation + background tracking
- `ios/SafeTrack/Services/BLEManager.swift` — CoreBluetooth scanner for BLE tags
- `ios/SafeTrack/Features/SOS/SOSManager.swift` — Silent Alert with hold-to-activate UI

### Android (Kotlin/Jetpack Compose)
- `android/.../location/LocationWorker.kt` — WorkManager periodic job + SMS fallback
- `android/.../sos/SOSManager.kt` — Extensible SOS mode dispatcher + Composable button

## Architecture

```
┌──────────────┐    WebSocket    ┌─────────────────────────────────┐
│  iOS Client  │ ◄────────────► │                                 │
└──────────────┘                │  Node.js / Express Backend       │
                                │  POST /api/v1/...                │
┌──────────────┐    REST/WS     │                                 │
│Android Client│ ◄────────────► │  Socket.IO real-time layer       │  ◄── PostgreSQL
└──────────────┘                │                                 │
                                │  Cron: retention purge           │
┌──────────────┐    REST/WS     │       ping expiry               │
│  Web PWA     │ ◄────────────► │       SOS auto-resolve          │
└──────────────┘                └─────────────────────────────────┘
                                              │
                                    SMS Gateway Webhook
                                    (Twilio / custom)
```
