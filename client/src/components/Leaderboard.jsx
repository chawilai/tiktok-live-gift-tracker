function formatCoins(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const RANK_COLORS = [
  "text-yellow-400",
  "text-slate-300",
  "text-amber-600",
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
              <p className="text-xs text-yellow-400 font-mono">~{Math.round(entry.totalCoins / 4)} ฿</p>
              <p className="text-xs text-slate-500">{entry.giftCount} gifts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
