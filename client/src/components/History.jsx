import { useState, useEffect } from "react";

function formatTime(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export default function History({ onAddChannel }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch("/api/history").then((r) => r.json()).then(setHistory).catch(() => {});
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Channel History</h2>
        <span className="text-xs text-slate-600 font-mono">{history.length} channels</span>
      </div>
      <p className="text-xs text-slate-600 mb-4">All channels that have been monitored. Click Monitor to add as a tab.</p>

      {history.length === 0 ? (
        <p className="text-slate-600 text-sm text-center py-6">No history yet — connect to a channel first</p>
      ) : (
        <div className="space-y-2">
          {history.map((ch) => (
            <div
              key={ch.username}
              className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2.5 hover:bg-slate-800 transition border border-slate-800"
            >
              {ch.profilePic ? (
                <img src={ch.profilePic} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {ch.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {ch.nickname && ch.nickname !== ch.username ? `${ch.nickname}` : `@${ch.username}`}
                </p>
                {ch.nickname && ch.nickname !== ch.username && (
                  <span className="text-[10px] text-slate-500">@{ch.username}</span>
                )}
                <p className="text-[10px] text-slate-500">
                  Last seen: {formatTime(ch.lastSeen)} · {ch.sessionCount} sessions
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-bold text-neon-cyan">{ch.totalCoins.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">{ch.totalGifts} gifts</p>
              </div>
              <button
                onClick={() => onAddChannel(ch.username, true)}
                className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-neon-cyan/30 transition shrink-0"
              >
                + Add Tab
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
