import { useMemo, useState } from "react";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const normalized = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function JoinLog({ joins }) {
  const [userFilter, setUserFilter] = useState("");

  const filtered = useMemo(() => {
    const u = userFilter.trim().toLowerCase();
    if (!u) return joins;
    return joins.filter((j) => {
      const nick = (j.nickname || "").toLowerCase();
      const uname = (j.username || "").toLowerCase();
      return nick.includes(u) || uname.includes(u);
    });
  }, [joins, userFilter]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Join Log</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Filter user..."
            className="w-36 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
          />
          <span className="text-xs text-slate-600 font-mono">{filtered.length} / {joins.length}</span>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[420px]">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">
            {joins.length === 0 ? "Waiting for viewers to join..." : "No joins match filter"}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {filtered.map((j, idx) => (
              <li
                key={j.id || `live-${idx}-${j.createdAt}`}
                className="px-4 py-2 flex items-center gap-3 hover:bg-slate-800/30 transition"
              >
                {j.profilePic ? (
                  <img src={j.profilePic} alt="" className="w-7 h-7 rounded-full shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0">
                    {j.nickname?.charAt(0) || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-200 truncate">{j.nickname || j.username}</div>
                  <div className="text-[10px] font-mono text-slate-600 truncate">@{j.username}</div>
                </div>
                <div className="text-[10px] font-mono text-slate-500 shrink-0">
                  {formatTime(j.createdAt || j.created_at)}
                </div>
                <span className="text-[10px] font-bold text-neon-green uppercase shrink-0">joined</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
