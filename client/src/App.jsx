import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import ConnectionBar from "./components/ConnectionBar.jsx";
import LiveEmbed from "./components/LiveEmbed.jsx";
import StatsCards from "./components/StatsCards.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import GiftLog from "./components/GiftLog.jsx";
import PopularGifts from "./components/PopularGifts.jsx";
import TriggerSettings from "./components/TriggerSettings.jsx";

export default function App() {
  const socketRef = useRef(null);
  const [status, setStatus] = useState({ connected: false, username: null });
  const [gifts, setGifts] = useState([]);
  const [stats, setStats] = useState({ allTime: { totalGifts: 0, totalCoins: 0 }, session: { totalGifts: 0, totalCoins: 0 } });
  const [leaderboard, setLeaderboard] = useState([]);
  const [popularGifts, setPopularGifts] = useState([]);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("gift", (gift) => {
      setGifts((prev) => {
        const streakKey = `${gift.username}-${gift.giftId}`;
        const filtered = prev.filter(
          (g) => g.id || g._streakKey !== streakKey
        );
        return [gift, ...filtered].slice(0, 200);
      });
      fetchStats();
      fetchLeaderboard();
      fetchPopularGifts();
    });

    socket.on("gift:streak", (gift) => {
      setGifts((prev) => {
        const streakKey = `${gift.username}-${gift.giftId}`;
        const idx = prev.findIndex(
          (g) => !g.id && g._streakKey === streakKey
        );
        const entry = { ...gift, _streakKey: streakKey };
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = entry;
          return updated;
        }
        return [entry, ...prev].slice(0, 200);
      });
    });

    socket.on("status", (s) => setStatus(s));

    fetchStatus();
    fetchGifts();
    fetchStats();
    fetchLeaderboard();
    fetchPopularGifts();

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
    giftPic: g.gift_pic,
    createdAt: g.created_at,
  })))).catch(() => {});
  const fetchStats = () => fetch("/api/stats").then(r => r.json()).then(setStats).catch(() => {});
  const fetchLeaderboard = () => fetch("/api/leaderboard").then(r => r.json()).then(setLeaderboard).catch(() => {});
  const fetchPopularGifts = () => fetch("/api/popular-gifts").then(r => r.json()).then(setPopularGifts).catch(() => {});

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
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-neon-cyan">TikTok</span> Live Gift Tracker
            </h1>
            <nav className="flex gap-1">
              <button
                onClick={() => setTab("dashboard")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === "dashboard"
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setTab("triggers")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                  tab === "triggers"
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Triggers
              </button>
            </nav>
          </div>
          <ConnectionBar
            status={status}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </header>

      {tab === "dashboard" ? (
        <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <LiveEmbed username={status.username} connected={status.connected} roomInfo={status.roomInfo} />
            <PopularGifts entries={popularGifts} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <StatsCards stats={stats} />
            <Leaderboard entries={leaderboard} />
          </div>

          <div className="lg:col-span-3">
            <GiftLog gifts={gifts} />
          </div>
        </main>
      ) : (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <TriggerSettings />
        </main>
      )}
    </div>
  );
}
