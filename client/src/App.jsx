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
  const [channels, setChannels] = useState([]); // [{ username, connected, roomInfo, sessionId }]
  const [activeTab, setActiveTab] = useState(null); // username or "triggers"
  const [channelData, setChannelData] = useState({}); // { username: { gifts, stats, leaderboard, popularGifts } }
  const [addInput, setAddInput] = useState("");

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("gift", (gift) => {
      const ch = gift.channel;
      setChannelData((prev) => {
        const d = prev[ch] || { gifts: [], stats: null, leaderboard: [], popularGifts: [] };
        const streakKey = `${gift.username}-${gift.giftId}`;
        const filtered = d.gifts.filter((g) => g.id || g._streakKey !== streakKey);
        return { ...prev, [ch]: { ...d, gifts: [gift, ...filtered].slice(0, 200) } };
      });
      fetchChannelStats(ch);
      fetchChannelLeaderboard(ch);
      fetchChannelPopularGifts(ch);
    });

    socket.on("gift:streak", (gift) => {
      const ch = gift.channel;
      setChannelData((prev) => {
        const d = prev[ch] || { gifts: [], stats: null, leaderboard: [], popularGifts: [] };
        const streakKey = `${gift.username}-${gift.giftId}`;
        const idx = d.gifts.findIndex((g) => !g.id && g._streakKey === streakKey);
        const entry = { ...gift, _streakKey: streakKey };
        let gifts;
        if (idx >= 0) {
          gifts = [...d.gifts];
          gifts[idx] = entry;
        } else {
          gifts = [entry, ...d.gifts].slice(0, 200);
        }
        return { ...prev, [ch]: { ...d, gifts } };
      });
    });

    socket.on("channel:status", (status) => {
      setChannels((prev) => {
        const idx = prev.findIndex((c) => c.username === status.username);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = status;
          return updated;
        }
        return prev;
      });
    });

    // Load existing channels
    fetch("/api/channels").then((r) => r.json()).then((chs) => {
      setChannels(chs);
      if (chs.length > 0 && !activeTab) {
        setActiveTab(chs[0].username);
      }
      chs.forEach((ch) => {
        if (ch.connected) loadChannelData(ch.username);
      });
    });

    return () => socket.disconnect();
  }, []);

  const loadChannelData = (username) => {
    fetchChannelGifts(username);
    fetchChannelStats(username);
    fetchChannelLeaderboard(username);
    fetchChannelPopularGifts(username);
  };

  const fetchChannelGifts = (ch) =>
    fetch(`/api/gifts?channel=${ch}&limit=200`).then((r) => r.json()).then((d) =>
      setChannelData((prev) => ({
        ...prev,
        [ch]: {
          ...(prev[ch] || {}),
          gifts: d.gifts.map((g) => ({
            id: g.id, username: g.username, nickname: g.nickname,
            giftName: g.gift_name, giftId: g.gift_id, diamondCount: g.diamond_count,
            repeatCount: g.repeat_count, profilePic: g.profile_pic, giftPic: g.gift_pic,
            createdAt: g.created_at, channel: ch,
          })),
        },
      }))
    ).catch(() => {});

  const fetchChannelStats = (ch) =>
    fetch(`/api/stats?channel=${ch}`).then((r) => r.json()).then((stats) =>
      setChannelData((prev) => ({ ...prev, [ch]: { ...(prev[ch] || {}), stats } }))
    ).catch(() => {});

  const fetchChannelLeaderboard = (ch) =>
    fetch(`/api/leaderboard?channel=${ch}`).then((r) => r.json()).then((lb) =>
      setChannelData((prev) => ({ ...prev, [ch]: { ...(prev[ch] || {}), leaderboard: lb } }))
    ).catch(() => {});

  const fetchChannelPopularGifts = (ch) =>
    fetch(`/api/popular-gifts?channel=${ch}`).then((r) => r.json()).then((pg) =>
      setChannelData((prev) => ({ ...prev, [ch]: { ...(prev[ch] || {}), popularGifts: pg } }))
    ).catch(() => {});

  const handleConnect = useCallback(async (username) => {
    const res = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const result = await res.json();
    if (result.connected) {
      setChannels((prev) => {
        if (prev.some((c) => c.username === username)) {
          return prev.map((c) => (c.username === username ? result : c));
        }
        return [...prev, result];
      });
      setActiveTab(username);
      loadChannelData(username);
    }
    return result;
  }, []);

  const handleDisconnect = useCallback(async (username) => {
    await fetch("/api/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setChannels((prev) =>
      prev.map((c) => (c.username === username ? { ...c, connected: false, roomInfo: null } : c))
    );
  }, []);

  const handleRemoveChannel = (username) => {
    handleDisconnect(username);
    setChannels((prev) => prev.filter((c) => c.username !== username));
    setChannelData((prev) => {
      const next = { ...prev };
      delete next[username];
      return next;
    });
    if (activeTab === username) {
      setActiveTab(channels.length > 1 ? channels.find((c) => c.username !== username)?.username || "triggers" : "triggers");
    }
  };

  const handleAddChannel = () => {
    const username = addInput.trim().replace("@", "");
    if (!username) return;
    if (channels.some((c) => c.username === username)) {
      setActiveTab(username);
      setAddInput("");
      return;
    }
    setAddInput("");
    handleConnect(username);
  };

  const activeChannel = channels.find((c) => c.username === activeTab);
  const data = channelData[activeTab] || { gifts: [], stats: null, leaderboard: [], popularGifts: [] };
  const defaultStats = { allTime: { totalGifts: 0, totalCoins: 0 }, session: { totalGifts: 0, totalCoins: 0 } };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="text-neon-cyan">TikTok</span> Live Gift Tracker
          </h1>

          {/* Channel tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {channels.map((ch) => {
              const chData = channelData[ch.username];
              const viewers = ch.roomInfo?.viewerCount || 0;
              const coins = chData?.stats?.allTime?.totalCoins || 0;
              return (
              <div key={ch.username} className="flex items-center">
                <button
                  onClick={() => { setActiveTab(ch.username); loadChannelData(ch.username); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                    activeTab === ch.username
                      ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${ch.connected ? "bg-neon-green" : "bg-slate-600"}`} />
                  @{ch.username}
                  {ch.connected && (
                    <span className="flex items-center gap-1.5 ml-1 text-[10px] font-mono">
                      {viewers > 0 && <span className="text-slate-500">{viewers.toLocaleString()}v</span>}
                      {coins > 0 && <span className="text-neon-cyan">{coins.toLocaleString()}c</span>}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleRemoveChannel(ch.username)}
                  className="text-slate-600 hover:text-red-400 px-1 text-xs transition"
                  title="Remove channel"
                >
                  x
                </button>
              </div>
              );
            })}

            {/* Add channel */}
            <div className="flex items-center gap-1 ml-1">
              <input
                type="text"
                value={addInput}
                onChange={(e) => setAddInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
                placeholder="+ username"
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan w-28"
              />
              <button
                onClick={handleAddChannel}
                disabled={!addInput.trim()}
                className="bg-neon-cyan/20 text-neon-cyan rounded-lg px-2 py-1 text-xs hover:bg-neon-cyan/30 transition disabled:opacity-30"
              >
                Add
              </button>
            </div>

            <div className="ml-auto">
              <button
                onClick={() => setActiveTab("triggers")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  activeTab === "triggers"
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                Triggers
              </button>
            </div>
          </div>
        </div>
      </header>

      {activeTab === "triggers" ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <TriggerSettings />
        </main>
      ) : activeChannel ? (
        <main className="max-w-7xl mx-auto px-4 py-6">
          {/* Connection controls for this channel */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block w-2 h-2 rounded-full ${activeChannel.connected ? "bg-neon-green animate-pulse" : "bg-slate-600"}`} />
              <span className={activeChannel.connected ? "text-neon-green" : "text-slate-500"}>
                {activeChannel.connected ? `Connected to @${activeChannel.username}` : `@${activeChannel.username} — Disconnected`}
              </span>
            </div>
            {!activeChannel.connected ? (
              <button
                onClick={() => handleConnect(activeChannel.username)}
                className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-neon-cyan/30 transition"
              >
                Connect
              </button>
            ) : (
              <button
                onClick={() => handleDisconnect(activeChannel.username)}
                className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-red-500/30 transition"
              >
                Disconnect
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <LiveEmbed username={activeChannel.username} connected={activeChannel.connected} roomInfo={activeChannel.roomInfo} />
              <PopularGifts entries={data.popularGifts || []} />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <StatsCards stats={data.stats || defaultStats} />
              <Leaderboard entries={data.leaderboard || []} />
            </div>

            <div className="lg:col-span-3">
              <GiftLog gifts={data.gifts || []} />
            </div>
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="text-slate-500">Add a TikTok username above to start monitoring</p>
        </main>
      )}
    </div>
  );
}
