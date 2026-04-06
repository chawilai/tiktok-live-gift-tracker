# TikTok Live Gift Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time web dashboard that detects TikTok Live gifts, logs them to SQLite, displays a leaderboard, stats, and embedded live video.

**Architecture:** Express backend connects to TikTok Live via `tiktok-live-connector`, saves gifts to SQLite, and pushes events via Socket.IO. React + Vite + Tailwind CSS 4.2 frontend renders a dark gaming-themed dashboard with real-time updates.

**Tech Stack:** Node.js (ESM), Express, Socket.IO, better-sqlite3, React 19, Vite, Tailwind CSS 4.2

---

## File Structure

```
tiktok_live/
├── package.json              # Root: backend deps + scripts
├── server/
│   ├── index.js              # Express + Socket.IO bootstrap
│   ├── db.js                 # SQLite setup, schema, query helpers
│   ├── tiktok.js             # TikTok live connector wrapper
│   └── routes.js             # REST API routes
├── client/
│   ├── index.html            # Vite entry HTML
│   ├── package.json          # Frontend deps
│   ├── vite.config.js        # Vite config with proxy to backend
│   ├── src/
│   │   ├── main.jsx          # React entry point
│   │   ├── App.jsx           # Root layout + socket provider
│   │   ├── App.css           # Tailwind imports + custom glow styles
│   │   ├── hooks/
│   │   │   └── useSocket.js  # Socket.IO hook
│   │   └── components/
│   │       ├── ConnectionBar.jsx
│   │       ├── LiveEmbed.jsx
│   │       ├── StatsCards.jsx
│   │       ├── Leaderboard.jsx
│   │       └── GiftLog.jsx
├── data/                     # SQLite DB file (gitignored)
└── .gitignore
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `data/` (directory)

- [ ] **Step 1: Initialize root package.json**

```json
{
  "name": "tiktok-live-gift-dashboard",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev:server": "node server/index.js",
    "dev:client": "npm run --prefix client dev",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\""
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
data/*.db
dist/
.env
```

- [ ] **Step 3: Create data directory**

```bash
mkdir -p data
```

- [ ] **Step 4: Install root dependencies**

```bash
npm install express socket.io tiktok-live-connector better-sqlite3 cors concurrently
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore data/
git commit -m "feat: scaffold project with root package.json and deps"
```

---

### Task 2: SQLite Database Layer

**Files:**
- Create: `server/db.js`

- [ ] **Step 1: Create server/db.js with schema and query helpers**

```js
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = `${__dirname}/../data/gifts.db`;

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tiktok_username TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    nickname TEXT,
    gift_name TEXT,
    gift_id INTEGER,
    diamond_count INTEGER DEFAULT 0,
    repeat_count INTEGER DEFAULT 1,
    profile_pic TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Prepared statements
const insertSession = db.prepare(
  "INSERT INTO sessions (tiktok_username) VALUES (?)"
);
const endSession = db.prepare(
  "UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?"
);
const insertGift = db.prepare(`
  INSERT INTO gifts (username, nickname, gift_name, gift_id, diamond_count, repeat_count, profile_pic, session_id)
  VALUES (@username, @nickname, @giftName, @giftId, @diamondCount, @repeatCount, @profilePic, @sessionId)
`);
const getGifts = db.prepare(`
  SELECT * FROM gifts ORDER BY created_at DESC LIMIT ? OFFSET ?
`);
const getGiftCount = db.prepare("SELECT COUNT(*) as count FROM gifts");
const getStats = db.prepare(`
  SELECT
    COUNT(*) as totalGifts,
    COALESCE(SUM(diamond_count * repeat_count), 0) as totalCoins
  FROM gifts
`);
const getSessionStats = db.prepare(`
  SELECT
    COUNT(*) as totalGifts,
    COALESCE(SUM(diamond_count * repeat_count), 0) as totalCoins
  FROM gifts WHERE session_id = ?
`);
const getLeaderboard = db.prepare(`
  SELECT
    nickname,
    username,
    profile_pic as profilePic,
    SUM(diamond_count * repeat_count) as totalCoins,
    COUNT(*) as giftCount
  FROM gifts
  GROUP BY username
  ORDER BY totalCoins DESC
  LIMIT 10
`);

export function createSession(tiktokUsername) {
  const result = insertSession.run(tiktokUsername);
  return result.lastInsertRowid;
}

export function closeSession(sessionId) {
  endSession.run(sessionId);
}

export function saveGift(gift) {
  const result = insertGift.run(gift);
  return result.lastInsertRowid;
}

export function fetchGifts(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const gifts = getGifts.all(limit, offset);
  const { count } = getGiftCount.get();
  return { gifts, total: count, page, limit };
}

export function fetchStats(sessionId) {
  const allTime = getStats.get();
  const session = sessionId ? getSessionStats.get(sessionId) : { totalGifts: 0, totalCoins: 0 };
  return { allTime, session };
}

export function fetchLeaderboard() {
  return getLeaderboard.all();
}

export default db;
```

- [ ] **Step 2: Verify db.js loads without errors**

```bash
node -e "import('./server/db.js').then(() => console.log('DB OK')).catch(e => console.error(e))"
```

Expected: `DB OK` and `data/gifts.db` file created.

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: add SQLite database layer with schema and query helpers"
```

---

### Task 3: TikTok Live Connector Wrapper

**Files:**
- Create: `server/tiktok.js`

- [ ] **Step 1: Create server/tiktok.js**

```js
import { WebcastPushConnection } from "tiktok-live-connector";

let connection = null;
let currentUsername = null;
let sessionId = null;

export function getStatus() {
  return {
    connected: connection !== null && connection.getState().isConnected,
    username: currentUsername,
    sessionId,
  };
}

export async function connect(username, { onGift, onChat, onDisconnect, onSessionId }) {
  // Disconnect existing connection first
  if (connection) {
    await disconnect();
  }

  currentUsername = username;
  connection = new WebcastPushConnection(username);

  try {
    await connection.connect();
  } catch (err) {
    connection = null;
    currentUsername = null;
    throw err;
  }

  // Store sessionId from callback
  if (onSessionId) {
    sessionId = onSessionId(username);
  }

  connection.on("gift", (data) => {
    if (onGift) onGift(data);
  });

  connection.on("chat", (data) => {
    if (onChat) onChat(data);
  });

  connection.on("disconnected", () => {
    connection = null;
    const oldSessionId = sessionId;
    sessionId = null;
    if (onDisconnect) onDisconnect(oldSessionId);
  });

  connection.on("error", (err) => {
    console.error("TikTok WebSocket error:", err.message);
  });

  return { connected: true, username };
}

export async function disconnect() {
  const oldSessionId = sessionId;
  if (connection) {
    try {
      connection.disconnect();
    } catch {
      // ignore disconnect errors
    }
    connection = null;
    currentUsername = null;
    sessionId = null;
  }
  return oldSessionId;
}
```

- [ ] **Step 2: Verify module loads**

```bash
node -e "import('./server/tiktok.js').then(m => console.log('Status:', m.getStatus())).catch(e => console.error(e))"
```

Expected: `Status: { connected: false, username: null, sessionId: null }`

- [ ] **Step 3: Commit**

```bash
git add server/tiktok.js
git commit -m "feat: add TikTok live connector wrapper"
```

---

### Task 4: REST API Routes

**Files:**
- Create: `server/routes.js`

- [ ] **Step 1: Create server/routes.js**

```js
import { Router } from "express";
import { fetchGifts, fetchStats, fetchLeaderboard } from "./db.js";
import { getStatus } from "./tiktok.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json(getStatus());
});

router.get("/gifts", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(fetchGifts(page, limit));
});

router.get("/stats", (req, res) => {
  const { sessionId } = getStatus();
  res.json(fetchStats(sessionId));
});

router.get("/leaderboard", (req, res) => {
  res.json(fetchLeaderboard());
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add server/routes.js
git commit -m "feat: add REST API routes for gifts, stats, leaderboard"
```

---

### Task 5: Express + Socket.IO Server

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Create server/index.js**

```js
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";
import { connect, disconnect, getStatus } from "./tiktok.js";
import { createSession, closeSession, saveGift } from "./db.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use("/api", routes);

// Connect endpoint — needs Socket.IO access so lives here
app.post("/api/connect", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  try {
    await connect(username, {
      onSessionId: (u) => {
        const id = createSession(u);
        io.emit("status", { connected: true, username: u });
        return id;
      },
      onGift: (data) => {
        const { sessionId } = getStatus();
        const gift = {
          username: data.uniqueId,
          nickname: data.nickname,
          giftName: data.giftName,
          giftId: data.giftId,
          diamondCount: data.diamondCount,
          repeatCount: data.repeatCount,
          profilePic: data.profilePictureUrl,
          sessionId,
        };
        const id = saveGift(gift);
        io.emit("gift", { id, ...gift, createdAt: new Date().toISOString() });
      },
      onChat: (data) => {
        io.emit("chat", {
          nickname: data.nickname,
          comment: data.comment,
          profilePic: data.profilePictureUrl,
        });
      },
      onDisconnect: (oldSessionId) => {
        if (oldSessionId) closeSession(oldSessionId);
        io.emit("status", { connected: false, username: null });
      },
    });
    res.json({ connected: true, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/disconnect", async (req, res) => {
  const oldSessionId = await disconnect();
  if (oldSessionId) closeSession(oldSessionId);
  io.emit("status", { connected: false, username: null });
  res.json({ connected: false });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Test server starts**

```bash
node server/index.js &
sleep 1
curl -s http://localhost:3000/api/status | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)))"
kill %1
```

Expected: `{ connected: false, username: null, sessionId: null }`

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "feat: add Express + Socket.IO server with TikTok live integration"
```

---

### Task 6: React + Vite + Tailwind CSS 4.2 Scaffolding

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/App.jsx`
- Create: `client/src/App.css`

- [ ] **Step 1: Create client/package.json**

```json
{
  "name": "tiktok-live-dashboard-client",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 2: Install client dependencies**

```bash
cd client
npm install react react-dom socket.io-client
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite
cd ..
```

- [ ] **Step 3: Create client/vite.config.js**

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 4: Create client/index.html**

```html
<!DOCTYPE html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TikTok Live Gift Tracker</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-slate-950 text-white min-h-screen">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create client/src/App.css**

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --color-neon-cyan: #22d3ee;
  --color-neon-pink: #ec4899;
  --color-neon-green: #4ade80;
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 5px var(--color-neon-cyan), 0 0 10px transparent; }
  50% { box-shadow: 0 0 15px var(--color-neon-cyan), 0 0 30px var(--color-neon-cyan); }
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.gift-row-new {
  animation: slide-in 0.3s ease-out, glow-pulse 1s ease-in-out;
}

.glow-border {
  box-shadow: 0 0 10px var(--color-neon-cyan), 0 0 20px rgba(34, 211, 238, 0.2);
}
```

- [ ] **Step 6: Create client/src/main.jsx**

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Create client/src/App.jsx (shell)**

```jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import ConnectionBar from "./components/ConnectionBar.jsx";
import LiveEmbed from "./components/LiveEmbed.jsx";
import StatsCards from "./components/StatsCards.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import GiftLog from "./components/GiftLog.jsx";

export default function App() {
  const socketRef = useRef(null);
  const [status, setStatus] = useState({ connected: false, username: null });
  const [gifts, setGifts] = useState([]);
  const [stats, setStats] = useState({ allTime: { totalGifts: 0, totalCoins: 0 }, session: { totalGifts: 0, totalCoins: 0 } });
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("gift", (gift) => {
      setGifts((prev) => [gift, ...prev].slice(0, 200));
      // Refresh stats and leaderboard on new gift
      fetchStats();
      fetchLeaderboard();
    });

    socket.on("status", (s) => setStatus(s));

    // Load initial data
    fetchStatus();
    fetchGifts();
    fetchStats();
    fetchLeaderboard();

    return () => socket.disconnect();
  }, []);

  const fetchStatus = () => fetch("/api/status").then(r => r.json()).then(setStatus).catch(() => {});
  const fetchGifts = () => fetch("/api/gifts?limit=200").then(r => r.json()).then(d => setGifts(d.gifts.map(g => ({
    id: g.id,
    username: g.username,
    nickname: g.nickname,
    giftName: g.gift_name,
    giftId: g.gift_id,
    diamondCount: g.diamond_count,
    repeatCount: g.repeat_count,
    profilePic: g.profile_pic,
    createdAt: g.created_at,
  })))).catch(() => {});
  const fetchStats = () => fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
  const fetchLeaderboard = () => fetch("/api/leaderboard").then(r => r.json()).then(setLeaderboard).catch(() => {});

  const handleConnect = useCallback(async (username) => {
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    return res.json();
  }, []);

  const handleDisconnect = useCallback(async () => {
    const res = await fetch("/api/disconnect", { method: "POST" });
    return res.json();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-neon-cyan">TikTok</span> Live Gift Tracker
          </h1>
          <ConnectionBar
            status={status}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Live embed */}
        <div className="lg:col-span-1 space-y-6">
          <LiveEmbed username={status.username} connected={status.connected} />
        </div>

        {/* Right column: Stats + Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          <StatsCards stats={stats} />
          <Leaderboard entries={leaderboard} />
        </div>

        {/* Full width: Gift log */}
        <div className="lg:col-span-3">
          <GiftLog gifts={gifts} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Create placeholder components so app compiles**

Create `client/src/components/` directory and placeholder files:

**client/src/components/ConnectionBar.jsx:**
```jsx
export default function ConnectionBar({ status, onConnect, onDisconnect }) {
  return <div className="text-slate-400">ConnectionBar placeholder</div>;
}
```

**client/src/components/LiveEmbed.jsx:**
```jsx
export default function LiveEmbed({ username, connected }) {
  return <div className="text-slate-400">LiveEmbed placeholder</div>;
}
```

**client/src/components/StatsCards.jsx:**
```jsx
export default function StatsCards({ stats }) {
  return <div className="text-slate-400">StatsCards placeholder</div>;
}
```

**client/src/components/Leaderboard.jsx:**
```jsx
export default function Leaderboard({ entries }) {
  return <div className="text-slate-400">Leaderboard placeholder</div>;
}
```

**client/src/components/GiftLog.jsx:**
```jsx
export default function GiftLog({ gifts }) {
  return <div className="text-slate-400">GiftLog placeholder</div>;
}
```

- [ ] **Step 9: Verify client starts**

```bash
cd client && npm run dev &
sleep 3
curl -s http://localhost:5173 | head -5
kill %1
cd ..
```

Expected: HTML output with `<div id="root">`.

- [ ] **Step 10: Commit**

```bash
git add client/
git commit -m "feat: scaffold React + Vite + Tailwind 4.2 client with placeholder components"
```

---

### Task 7: ConnectionBar Component

**Files:**
- Modify: `client/src/components/ConnectionBar.jsx`

- [ ] **Step 1: Implement ConnectionBar**

```jsx
import { useState } from "react";

export default function ConnectionBar({ status, onConnect, onDisconnect }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onConnect(username.trim().replace("@", ""));
      if (result.error) setError(result.error);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    await onDisconnect();
    setLoading(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">@</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="TikTok username"
          disabled={loading || status.connected}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan disabled:opacity-50 w-48"
        />
      </div>

      {!status.connected ? (
        <button
          onClick={handleConnect}
          disabled={loading || !username.trim()}
          className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-neon-cyan/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      ) : (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-red-500/30 transition disabled:opacity-50"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full ${status.connected ? "bg-neon-green animate-pulse" : "bg-slate-600"}`} />
        <span className={status.connected ? "text-neon-green" : "text-slate-500"}>
          {status.connected ? `Connected to @${status.username}` : "Disconnected"}
        </span>
      </div>

      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/ConnectionBar.jsx
git commit -m "feat: implement ConnectionBar component with connect/disconnect UI"
```

---

### Task 8: LiveEmbed Component

**Files:**
- Modify: `client/src/components/LiveEmbed.jsx`

- [ ] **Step 1: Implement LiveEmbed with iframe + fallback**

```jsx
import { useState } from "react";

export default function LiveEmbed({ username, connected }) {
  const [embedFailed, setEmbedFailed] = useState(false);

  if (!username) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="text-4xl mb-3 opacity-50">📺</div>
        <p className="text-slate-500 text-sm">Enter a username and connect to see the live stream</p>
      </div>
    );
  }

  const liveUrl = `https://www.tiktok.com/@${username}/live`;

  if (embedFailed) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center space-y-3">
        <div className="text-4xl">📺</div>
        <p className="text-slate-300 text-sm font-medium">@{username}</p>
        <p className="text-slate-500 text-xs">Embed not available — TikTok blocks iframe embedding</p>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-neon-pink/30 transition"
        >
          Open TikTok Live
        </a>
        {connected && (
          <p className="text-neon-green text-xs flex items-center justify-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            Receiving gifts in real-time
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="aspect-[9/16] max-h-[500px]">
        <iframe
          src={liveUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          onError={() => setEmbedFailed(true)}
          onLoad={(e) => {
            // Detect if TikTok blocked the embed (X-Frame-Options)
            // We can't reliably detect this from JS, so set a timeout fallback
            setTimeout(() => setEmbedFailed(true), 3000);
          }}
          title="TikTok Live"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/LiveEmbed.jsx
git commit -m "feat: implement LiveEmbed component with iframe and fallback link"
```

---

### Task 9: StatsCards Component

**Files:**
- Modify: `client/src/components/StatsCards.jsx`

- [ ] **Step 1: Implement StatsCards**

```jsx
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function Card({ label, value, icon, color }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${color}`}>{formatNumber(value)}</p>
    </div>
  );
}

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card label="Total Gifts" value={stats.allTime.totalGifts} icon="🎁" color="text-neon-pink" />
      <Card label="Total Coins" value={stats.allTime.totalCoins} icon="💎" color="text-neon-cyan" />
      <Card label="Session Gifts" value={stats.session.totalGifts} icon="🎯" color="text-neon-green" />
      <Card label="Session Coins" value={stats.session.totalCoins} icon="⚡" color="text-yellow-400" />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/StatsCards.jsx
git commit -m "feat: implement StatsCards component with formatted stats display"
```

---

### Task 10: Leaderboard Component

**Files:**
- Modify: `client/src/components/Leaderboard.jsx`

- [ ] **Step 1: Implement Leaderboard**

```jsx
function formatCoins(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const RANK_COLORS = [
  "text-yellow-400",  // 1st — gold
  "text-slate-300",   // 2nd — silver
  "text-amber-600",   // 3rd — bronze
];

export default function Leaderboard({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Leaderboard</h2>
        <p className="text-slate-600 text-sm text-center py-4">No gifts yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Top Gifters</h2>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div
            key={entry.username}
            className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2 hover:bg-slate-800 transition"
          >
            <span className={`font-mono font-bold text-sm w-6 text-center ${RANK_COLORS[i] || "text-slate-500"}`}>
              {i + 1}
            </span>
            {entry.profilePic ? (
              <img src={entry.profilePic} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                {entry.nickname?.charAt(0) || "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{entry.nickname}</p>
              <p className="text-xs text-slate-500">@{entry.username}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-mono font-bold text-neon-cyan">{formatCoins(entry.totalCoins)}</p>
              <p className="text-xs text-slate-500">{entry.giftCount} gifts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Leaderboard.jsx
git commit -m "feat: implement Leaderboard component with top 10 gifters"
```

---

### Task 11: GiftLog Component

**Files:**
- Modify: `client/src/components/GiftLog.jsx`

- [ ] **Step 1: Implement GiftLog**

```jsx
import { useRef, useEffect, useState } from "react";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function GiftLog({ gifts }) {
  const [newIds, setNewIds] = useState(new Set());
  const prevLengthRef = useRef(gifts.length);

  useEffect(() => {
    // Mark new gifts for animation
    if (gifts.length > prevLengthRef.current) {
      const count = gifts.length - prevLengthRef.current;
      const ids = new Set(gifts.slice(0, count).map((g) => g.id));
      setNewIds(ids);
      const timer = setTimeout(() => setNewIds(new Set()), 1500);
      return () => clearTimeout(timer);
    }
    prevLengthRef.current = gifts.length;
  }, [gifts]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Gift Log</h2>
        <span className="text-xs text-slate-600 font-mono">{gifts.length} entries</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Gift</th>
              <th className="px-4 py-2 text-right">Count</th>
              <th className="px-4 py-2 text-right">Coins</th>
            </tr>
          </thead>
          <tbody>
            {gifts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                  Waiting for gifts...
                </td>
              </tr>
            ) : (
              gifts.map((gift) => (
                <tr
                  key={gift.id}
                  className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${
                    newIds.has(gift.id) ? "gift-row-new" : ""
                  }`}
                >
                  <td className="px-4 py-2 font-mono text-xs text-slate-400">
                    {formatTime(gift.createdAt)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {gift.profilePic ? (
                        <img src={gift.profilePic} alt="" className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px]">
                          {gift.nickname?.charAt(0) || "?"}
                        </div>
                      )}
                      <span className="truncate max-w-[120px]">{gift.nickname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neon-pink font-medium">{gift.giftName}</td>
                  <td className="px-4 py-2 text-right font-mono">x{gift.repeatCount}</td>
                  <td className="px-4 py-2 text-right font-mono text-neon-cyan">
                    {(gift.diamondCount * gift.repeatCount).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {gifts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600 text-right">
          Showing latest {gifts.length} gifts
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/GiftLog.jsx
git commit -m "feat: implement GiftLog component with realtime table and glow animation"
```

---

### Task 12: Integration Test — Full Stack Smoke Test

- [ ] **Step 1: Start both servers and verify full stack**

Terminal 1:
```bash
node server/index.js
```

Terminal 2:
```bash
cd client && npm run dev
```

- [ ] **Step 2: Manual verification checklist**

Open `http://localhost:5173` in browser and verify:

1. Dark theme renders with slate background
2. Header shows "TikTok Live Gift Tracker"
3. Username input and Connect button visible
4. Status shows "Disconnected"
5. Stats cards show 0 for all values
6. Leaderboard shows "No gifts yet"
7. Gift log shows "Waiting for gifts..."

- [ ] **Step 3: Test connect flow (with a real live user)**

1. Enter `biesukrit_w` in username field
2. Click Connect
3. Status should change to green "Connected to @biesukrit_w"
4. LiveEmbed should show link/embed for TikTok Live
5. When gifts arrive, they should appear in GiftLog with glow animation
6. Stats and leaderboard should update in real-time

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete TikTok Live Gift Dashboard v1.0"
```
