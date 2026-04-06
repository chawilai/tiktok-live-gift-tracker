import { useState, useEffect, useRef } from "react";

export default function Watchlist({ onAddChannel }) {
  const [list, setList] = useState([]);
  const [liveStatus, setLiveStatus] = useState({});
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    fetchList();
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (list.length === 0) return;
    checkAllLive(list);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => checkAllLive(list), 30000);
    return () => clearInterval(intervalRef.current);
  }, [list]);

  const fetchList = async () => {
    const res = await fetch("/api/watchlist").then((r) => r.json());
    setList(res);
  };

  const checkAllLive = async (usernames) => {
    setChecking(true);
    const results = await Promise.all(
      usernames.map((u) =>
        fetch(`/api/check-live/${u}`).then((r) => r.json()).catch(() => ({ live: false, username: u }))
      )
    );
    const status = {};
    results.forEach((r) => { status[r.username] = r.live; });
    setLiveStatus(status);
    setChecking(false);
  };

  const handleAdd = async () => {
    const username = input.trim().replace("@", "");
    if (!username || list.includes(username)) return;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    setInput("");
    setList((prev) => [...prev, username]);
  };

  const handleRemove = async (username) => {
    await fetch(`/api/watchlist/${username}`, { method: "DELETE" });
    setList((prev) => prev.filter((u) => u !== username));
    setLiveStatus((prev) => { const n = { ...prev }; delete n[username]; return n; });
  };

  const handleMonitor = (username) => {
    if (onAddChannel) onAddChannel(username);
  };

  // Sort: live first
  const sorted = [...list].sort((a, b) => {
    const aLive = liveStatus[a] ? 1 : 0;
    const bLive = liveStatus[b] ? 1 : 0;
    return bLive - aLive;
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Watchlist</h2>
          <span className="text-xs text-slate-600 font-mono">
            {checking ? "checking..." : `${Object.values(liveStatus).filter(Boolean).length} live / ${list.length}`}
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Add TikTok usernames to watch. Auto-checks live status every 30 seconds.
        </p>

        {/* Add input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="@username"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-neon-cyan/30 transition disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {sorted.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No users in watchlist</p>
          ) : (
            sorted.map((username) => {
              const isLive = liveStatus[username];
              return (
                <div
                  key={username}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                    isLive
                      ? "bg-neon-green/10 border border-neon-green/30"
                      : "bg-slate-800/30 border border-slate-800"
                  }`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isLive ? "bg-neon-green animate-pulse" : "bg-slate-600"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isLive ? "text-neon-green" : "text-slate-400"}`}>
                      @{username}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {isLive ? "LIVE NOW" : "Offline"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isLive && (
                      <button
                        onClick={() => handleMonitor(username)}
                        className="bg-neon-green/20 text-neon-green border border-neon-green/50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-neon-green/30 transition"
                      >
                        Monitor
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(username)}
                      className="text-slate-600 hover:text-red-400 text-xs transition px-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {list.length > 0 && (
          <button
            onClick={() => checkAllLive(list)}
            disabled={checking}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition disabled:opacity-50"
          >
            Refresh status now
          </button>
        )}
      </div>
    </div>
  );
}
