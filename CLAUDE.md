# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TikTok Live Gift Tracker — a real-time dashboard for monitoring TikTok Live gifts across multiple channels simultaneously. Features gift logging, leaderboards, popular gifts ranking, webhook triggers for external integrations (ESP32/IoT), watchlist with live detection, and channel history.

## Commands

```bash
# Development (runs both backend + frontend concurrently)
npm run dev

# Backend only (Express on port 3000)
npm run dev:server

# Frontend only (Vite on port 5173)
npm run dev:client

# Run tests (Node.js built-in test runner)
npm test

# Build frontend for production
npm run --prefix client build
```

## Architecture

**Backend:** Express + Socket.IO server (`server/`) connects to TikTok Live via `tiktok-live-connector`, saves gifts to SQLite (`better-sqlite3`), and pushes real-time events to the frontend.

**Frontend:** React 19 + Vite + Tailwind CSS 4.2 (`client/src/`) with dark gaming theme. Communicates via Socket.IO for real-time updates and REST API for historical data.

**Data flow:**
```
TikTok Live WebSocket → server/tiktok.js (multi-channel Map)
  → server/index.js (save to DB + emit Socket.IO + fire webhook triggers)
  → client App.jsx (per-channel state: gifts, stats, leaderboard)
```

### Key Backend Modules

- `server/tiktok.js` — Manages a `Map` of concurrent TikTok connections keyed by username. Exposes `connectChannel()`, `disconnectChannel()`, `getAllChannels()`.
- `server/db.js` — SQLite schema (sessions, gifts, triggers, watchlist), prepared statements, and query helpers. Uses WAL mode. Includes migrations for schema evolution via `ALTER TABLE` wrapped in try/catch.
- `server/index.js` — Express server, Socket.IO setup, connect/disconnect endpoints, gift event handling with streak detection (`giftType === 1` + `repeatEnd`), webhook trigger firing.
- `server/image-cache.js` — Downloads and caches avatar/gift images from TikTok CDN to `data/cache/`. Served via Express static at `/cache/`.

### Streak Gift Handling

TikTok sends intermediate events for streak gifts (e.g., Rose x1, x2, x3...). Only the final event (`repeatEnd === true`) is saved to DB. Intermediate events are emitted as `gift:streak` for live UI updates, then replaced when the final `gift` event arrives.

### Database

SQLite at `data/gifts.db`. Key tables: `sessions` (channel connections), `gifts` (gift events with FK to sessions), `triggers` (gift_id → webhook endpoint mapping), `watchlist` (usernames to monitor for live status).

### Frontend State

`App.jsx` manages per-channel data in `channelData` state object keyed by username. Each channel has independent gifts, stats, leaderboard, and popular gifts. Socket.IO events include `channel` field to route data to the correct tab.

## Conventions

- ESM throughout (`"type": "module"` in package.json)
- Vite proxies `/api`, `/cache`, and `/socket.io` to backend port 3000
- THB conversion: `coins / 4` (approximate creator earnings)
- Image cache: avatars at `data/cache/avatars/{username}.webp`, gifts at `data/cache/gifts/{giftId}.webp`
- DB migrations use `ALTER TABLE` wrapped in empty catch blocks for idempotency
- Global `cursor: pointer` on all buttons/links/selects via App.css

## Deployment (Production)

Deployed at **https://haanhaan.com** on VPS `43.229.150.41` (Ubuntu 24.04).

- **App path:** `/var/www/haanhaan.com/app/`
- **PM2 process:** `tiktok-live` on port 3100
- **Nginx:** reverse proxy for `/api/`, `/socket.io/`, `/cache/` → port 3100; serves React build from `client/dist/`
- **SSL:** Let's Encrypt via certbot
- **SSH:** `sshinspace` alias (`ssh chawilai@43.229.150.41`)

**Deploy update:**
```bash
sshinspace
cd /var/www/haanhaan.com/app
git pull
cd client && npm run build && cd ..
pm2 restart tiktok-live
```
