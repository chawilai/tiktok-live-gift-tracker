# TikTok Live Gift Tracker

Real-time dashboard for monitoring TikTok Live gifts across multiple channels simultaneously.

**Live:** https://haanhaan.com

## Features

- **Multi-Channel Monitoring** — Monitor multiple TikTok Live streams as tabs, each with independent dashboard
- **Real-time Gift Detection** — Detect gifts instantly via WebSocket with streak handling (no double-counting)
- **Gift Log** — Scrollable table with time, user avatar, gift icon, count, coins, and THB value
- **Leaderboard** — Top 10 gifters ranked by total coins
- **Popular Gifts** — Most sent gifts with icons, counts, and total value
- **Stats Cards** — Total/session gifts and coins with THB conversion (coins / 4)
- **Webhook Triggers** — Map each gift type to a custom API endpoint for IoT/ESP32 integration
- **Watchlist** — Add usernames to watch, auto-detect live status every 30 seconds
- **Channel History** — Browse all previously monitored channels with stats
- **Image Caching** — Auto-download avatars and gift icons from TikTok CDN for offline access
- **Dark Gaming Theme** — Neon cyan/pink/green theme with glow animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 4.2 |
| Real-time | Socket.IO |
| Backend | Express 5, tiktok-live-connector |
| Database | SQLite (better-sqlite3) |
| Process Manager | PM2 |
| Reverse Proxy | Nginx |

## Quick Start

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Run development (backend + frontend)
npm run dev
```

Open http://localhost:5173, add a TikTok username, and click Connect.

## Webhook Payload

When a gift matches a configured trigger, a POST request is sent:

```json
{
  "timestamp": "2026-04-06T21:30:00.000Z",
  "channel": "tuenthum",
  "user": "nickname",
  "username": "tiktok_id",
  "giftName": "Rose",
  "giftId": 5655,
  "diamondCount": 1,
  "repeatCount": 5,
  "totalCoins": 5,
  "thb": 1.25
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/channels | List active channels |
| POST | /api/connect | Connect to a TikTok Live channel |
| POST | /api/disconnect | Disconnect from a channel |
| GET | /api/gifts?channel=x | Gift history (paginated) |
| GET | /api/stats?channel=x | Total and session stats |
| GET | /api/leaderboard?channel=x | Top 10 gifters |
| GET | /api/popular-gifts?channel=x | Most popular gifts |
| GET | /api/history | All previously monitored channels |
| GET/PUT/DELETE | /api/triggers/:giftId | Webhook trigger CRUD |
| GET/POST/DELETE | /api/watchlist | Watchlist management |
| GET | /api/check-live/:username | Check if user is currently live |

## Production Deployment

Deployed on Ubuntu 24.04 VPS with Nginx + PM2 + Let's Encrypt SSL.

```bash
# On VPS
git clone https://github.com/chawilai/tiktok-live-gift-tracker.git app
cd app && npm install
cd client && npm install && npm run build && cd ..
PORT=3100 pm2 start server/index.js --name tiktok-live
```

Configure Nginx to reverse proxy `/api/`, `/socket.io/`, `/cache/` to port 3100 and serve `client/dist/` for static files.

## License

MIT
