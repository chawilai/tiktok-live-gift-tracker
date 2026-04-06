# TikTok Live Gift Dashboard — Design Spec

## Overview

Real-time dashboard for detecting TikTok Live gifts, logging gift details, displaying leaderboards, and preparing trigger actions for physical devices (ESP32). Includes embedded TikTok Live video with fallback.

## Architecture

```
Browser (React + Vite + Tailwind 4.2)
  │ Socket.IO (WebSocket)
  ▼
Node.js Backend (Express)
  │ tiktok-live-connector + Socket.IO server + REST API
  ▼
SQLite (better-sqlite3)
```

## Backend

### Server: Express + Socket.IO

Single Express server serving both REST API and Socket.IO on the same port (default 3000).

### REST API

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/connect | Connect to TikTok Live (body: `{ username }`) |
| POST | /api/disconnect | Disconnect from TikTok Live |
| GET | /api/status | Connection status + current username |
| GET | /api/gifts | Gift history with pagination (`?page=1&limit=50`) |
| GET | /api/stats | Summary: total gifts, total coins, session gifts |
| GET | /api/leaderboard | Top 10 gifters sorted by total coins |

### Socket.IO Events (server → client)

| Event | Payload | Description |
|-------|---------|-------------|
| `gift` | Gift object | New gift received |
| `chat` | Chat object | Chat message |
| `status` | `{ connected, username }` | Connection state change |

### TikTok Live Connector

- Uses `tiktok-live-connector` package
- Listens for `gift`, `chat`, `error`, `disconnected` events
- On gift: save to SQLite + emit via Socket.IO
- Only one connection at a time; disconnect previous before new connect

## Database (SQLite)

### gifts table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT | TikTok username of gifter |
| nickname | TEXT | Display name |
| gift_name | TEXT | Gift name (e.g., "Rose") |
| gift_id | INTEGER | TikTok gift ID |
| diamond_count | INTEGER | Coin value |
| repeat_count | INTEGER | Gift count |
| profile_pic | TEXT | Profile picture URL |
| session_id | INTEGER | FK to sessions |
| created_at | DATETIME | Timestamp |

### sessions table

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK AUTOINCREMENT | |
| tiktok_username | TEXT | Who is live |
| started_at | DATETIME | Session start |
| ended_at | DATETIME | Session end (null if active) |

## Frontend (React + Vite + Tailwind CSS 4.2)

### Theme: Dark Gaming/Streaming

- Background: slate-950/slate-900
- Accent colors: cyan-400 (primary), pink-500 (gifts), green-400 (status)
- Neon glow effects on new gifts
- Monospace font for numbers, sans-serif for text

### Layout

```
┌─────────────────────────────────────────────┐
│  Header: TikTok Live Gift Tracker           │
│  [Username input] [Connect] [Disconnect]    │
│  Status: Connected to @username             │
├────────────────────┬────────────────────────┤
│                    │  Stats Cards           │
│  TikTok Live       │  Total Gifts | Total   │
│  Embed / Link      │  Coins | Live Gifts   │
│                    ├────────────────────────┤
│                    │  Leaderboard (Top 10)  │
├────────────────────┴────────────────────────┤
│  Gift Log Table (realtime, auto-scroll)     │
│  Time | User | Gift | Count | Coins         │
└─────────────────────────────────────────────┘
```

### Components

| Component | Responsibility |
|-----------|---------------|
| `App` | Layout, socket connection, global state |
| `ConnectionBar` | Username input, connect/disconnect buttons, status indicator |
| `LiveEmbed` | TikTok live iframe embed, fallback to link + profile image |
| `StatsCards` | Total gifts, total coins, session gift count |
| `Leaderboard` | Top 10 gifters ranked by coins |
| `GiftLog` | Realtime scrollable gift table with glow animation on new rows |

### TikTok Live Embed Strategy

1. Try embedding via iframe: `https://www.tiktok.com/@{username}/live`
2. If blocked by TikTok's iframe policy, fallback to clickable link with profile info

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS 4.2 |
| Realtime | Socket.IO |
| Backend | Express, tiktok-live-connector |
| Database | SQLite via better-sqlite3 |
| Module System | ESM ("type": "module") |

## Project Structure

```
tiktok_live/
├── server/
│   ├── index.js          # Express + Socket.IO server
│   ├── db.js             # SQLite setup + queries
│   ├── tiktok.js         # TikTok live connector wrapper
│   └── routes.js         # REST API routes
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ConnectionBar.jsx
│   │   │   ├── LiveEmbed.jsx
│   │   │   ├── StatsCards.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   └── GiftLog.jsx
│   │   └── App.css       # Tailwind imports
│   ├── vite.config.js
│   └── tailwind.config.js (if needed for 4.2)
├── package.json
├── data/                 # SQLite DB file location
└── docs/
```

## Out of Scope (Future)

- ESP32 integration (Step 6 from user's original plan)
- Gift-to-action mapping UI
- Multi-session comparison
- User authentication
