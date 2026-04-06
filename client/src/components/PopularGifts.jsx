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

export default function PopularGifts({ entries }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Popular Gifts</h2>
        <p className="text-slate-600 text-sm text-center py-4">No gifts yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Popular Gifts</h2>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div
            key={entry.giftId}
            className="flex items-center gap-3 rounded-lg bg-slate-800/50 px-3 py-2 hover:bg-slate-800 transition"
          >
            <span className={`font-mono font-bold text-sm w-6 text-center ${RANK_COLORS[i] || "text-slate-500"}`}>
              {i + 1}
            </span>
            {entry.giftPic ? (
              <img src={entry.giftPic} alt={entry.giftName} className="w-8 h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center text-xs">
                🎁
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neon-pink">{entry.giftName}</p>
              <p className="text-xs text-slate-500">{entry.diamondCount} coins/each</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-mono text-slate-300">x{entry.totalCount.toLocaleString()}</p>
              <p className="text-xs text-slate-500">times</p>
            </div>
            <div className="text-right min-w-[70px]">
              <p className="text-sm font-mono font-bold text-neon-cyan">{formatCoins(entry.totalCoins)}</p>
              <p className="text-xs text-yellow-400 font-mono">~{Math.round(entry.totalCoins / 4)} ฿</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
