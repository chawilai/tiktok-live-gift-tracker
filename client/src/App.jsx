import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import ConnectionBar from "./components/ConnectionBar.jsx";
import LiveEmbed from "./components/LiveEmbed.jsx";
import StatsCards from "./components/StatsCards.jsx";
import Leaderboard from "./components/Leaderboard.jsx";
import GiftLog from "./components/GiftLog.jsx";
import CommentLog from "./components/CommentLog.jsx";
import PopularGifts from "./components/PopularGifts.jsx";
import TriggerSettings from "./components/TriggerSettings.jsx";
import CommentTriggerSettings from "./components/CommentTriggerSettings.jsx";
import Watchlist from "./components/Watchlist.jsx";
import History from "./components/History.jsx";

export default function App() {
  const socketRef = useRef(null);
  const [channels, setChannels] = useState([]); // [{ username, connected, roomInfo, sessionId }]
  const [activeTab, setActiveTab] = useState(null); // username or "triggers"
  const [channelData, setChannelData] = useState({}); // { username: { gifts, comments, stats, leaderboard, popularGifts } }
  const [commentTriggerKeywords, setCommentTriggerKeywords] = useState([]);
  const [addInput, setAddInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

    socket.on("comment", (comment) => {
      const ch = comment.channel;
      setChannelData((prev) => {
        const d = prev[ch] || { gifts: [], comments: [], stats: null, leaderboard: [], popularGifts: [] };
        return { ...prev, [ch]: { ...d, comments: [comment, ...(d.comments || [])].slice(0, 300) } };
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

    socket.on("channel:viewers", ({ username, viewerCount }) => {
      setChannels((prev) =>
        prev.map((c) =>
          c.username === username && c.roomInfo
            ? { ...c, roomInfo: { ...c.roomInfo, viewerCount } }
            : c
        )
      );
    });

    // Load comment trigger keywords (for highlight in CommentLog)
    fetch("/api/comment-triggers").then((r) => r.json()).then((list) => {
      setCommentTriggerKeywords(list.map((t) => t.keyword));
    }).catch(() => {});

    socket.on("comment-trigger:fired", () => {
      // refresh keyword list when triggers change externally
      fetch("/api/comment-triggers").then((r) => r.json()).then((list) => {
        setCommentTriggerKeywords(list.map((t) => t.keyword));
      }).catch(() => {});
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
    fetchChannelComments(username);
  };

  const fetchChannelComments = (ch) =>
    fetch(`/api/comments?channel=${ch}&limit=200`).then((r) => r.json()).then((list) =>
      setChannelData((prev) => ({
        ...prev,
        [ch]: {
          ...(prev[ch] || {}),
          comments: list.map((c) => ({
            id: c.id,
            username: c.username,
            nickname: c.nickname,
            profilePic: c.profile_pic,
            comment: c.comment,
            createdAt: c.created_at,
            channel: ch,
          })),
        },
      }))
    ).catch(() => {});

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

  const handleAddTab = useCallback((username, stayOnPage = false) => {
    username = username.trim().replace("@", "");
    if (!username) return;
    setChannels((prev) => {
      if (prev.some((c) => c.username === username)) return prev;
      return [...prev, { username, connected: false, sessionId: null, roomInfo: null }];
    });
    if (!stayOnPage) setActiveTab(username);
    loadChannelData(username);
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
  const data = channelData[activeTab] || { gifts: [], comments: [], stats: null, leaderboard: [], popularGifts: [] };
  const defaultStats = { allTime: { totalGifts: 0, totalCoins: 0 }, session: { totalGifts: 0, totalCoins: 0 } };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold tracking-tight mb-2">
            <span className="text-neon-cyan">TikTok</span> Live Gift Tracker
          </h1>

          {/* Channel tabs + Settings */}
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
            {channels.map((ch) => {
              const chData = channelData[ch.username];
              const viewers = ch.roomInfo?.viewerCount || 0;
              const coins = chData?.stats?.allTime?.totalCoins || 0;
              const pic = ch.roomInfo?.profilePic;
              const nick = ch.roomInfo?.nickname || ch.username;
              const isActive = activeTab === ch.username;
              return (
              <div key={ch.username} className="relative group">
                <button
                  onClick={() => { setActiveTab(ch.username); loadChannelData(ch.username); }}
                  className={`flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl transition ${
                    isActive
                      ? "bg-slate-800 border border-neon-cyan/40 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                      : "bg-slate-900/50 border border-slate-800 hover:bg-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {pic ? (
                      <img src={pic} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                        {ch.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${ch.connected ? "bg-neon-green" : "bg-slate-600"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col items-start min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate max-w-[100px] ${isActive ? "text-white" : "text-slate-300"}`}>
                        {nick}
                      </span>
                      {ch.connected && viewers > 0 && (
                        <span className="text-[10px] text-slate-500 font-mono">{viewers.toLocaleString()} viewers</span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-neon-cyan">
                      {coins > 0 ? `${coins.toLocaleString()} coins · ~${Math.round(coins / 4)} ฿` : `@${ch.username}`}
                    </span>
                  </div>
                </button>
                {/* Remove button */}
                <button
                  onClick={() => handleRemoveChannel(ch.username)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-slate-500 hover:text-red-400 hover:border-red-500/50 text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
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

          </div>{/* end scroll container */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  ["triggers", "comment-triggers", "watchlist", "history"].includes(activeTab)
                    ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
                <svg className={`w-3 h-3 transition ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-[100]">
                  <button
                    onClick={() => { setActiveTab("triggers"); setMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      activeTab === "triggers" ? "text-neon-cyan bg-slate-700/50" : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span>Gift Triggers</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("comment-triggers"); setMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      activeTab === "comment-triggers" ? "text-neon-cyan bg-slate-700/50" : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span>Comment Triggers</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("watchlist"); setMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      activeTab === "watchlist" ? "text-neon-cyan bg-slate-700/50" : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span>Watchlist</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("history"); setMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition ${
                      activeTab === "history" ? "text-neon-cyan bg-slate-700/50" : "text-slate-300 hover:bg-slate-700/50"
                    }`}
                  >
                    <span>History</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {activeTab === "triggers" ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <TriggerSettings />
        </main>
      ) : activeTab === "comment-triggers" ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <CommentTriggerSettings />
        </main>
      ) : activeTab === "watchlist" ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <Watchlist onAddChannel={handleAddTab} />
        </main>
      ) : activeTab === "history" ? (
        <main className="max-w-3xl mx-auto px-4 py-6">
          <History onAddChannel={handleAddTab} />
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

            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GiftLog gifts={data.gifts || []} />
              <CommentLog comments={data.comments || []} triggerKeywords={commentTriggerKeywords} />
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
