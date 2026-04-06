import { useRef, useEffect, useState } from "react";

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function GiftLog({ gifts }) {
  const [newIds, setNewIds] = useState(new Set());
  const prevLengthRef = useRef(gifts.length);

  useEffect(() => {
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
              <th className="px-4 py-2 text-right">THB</th>
            </tr>
          </thead>
          <tbody>
            {gifts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                  Waiting for gifts...
                </td>
              </tr>
            ) : (
              gifts.map((gift, idx) => {
                const isStreak = !gift.id;
                const totalCoins = gift.diamondCount * gift.repeatCount;
                const thb = (totalCoins / 4).toFixed(totalCoins >= 4 ? 0 : 2);
                return (
                  <tr
                    key={gift.id || `streak-${gift._streakKey || idx}`}
                    className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition ${
                      newIds.has(gift.id) ? "gift-row-new" : ""
                    } ${isStreak ? "opacity-70" : ""}`}
                  >
                    <td className="px-4 py-2 font-mono text-xs text-slate-400">
                      {formatTime(gift.createdAt)}
                      {isStreak && (
                        <span className="ml-1 text-yellow-400 animate-pulse">LIVE</span>
                      )}
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
                      {totalCoins.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-yellow-400 text-xs">
                      {thb} ฿
                    </td>
                  </tr>
                );
              })
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
