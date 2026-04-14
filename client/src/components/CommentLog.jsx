import { useMemo, useState } from "react";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const normalized = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function CommentLog({ comments, triggerKeywords = [] }) {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const normalizedKeywords = useMemo(
    () => new Set(triggerKeywords.map((k) => k.toLowerCase())),
    [triggerKeywords]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const u = userFilter.trim().toLowerCase();
    return comments.filter((c) => {
      if (q && !(c.comment || "").toLowerCase().includes(q)) return false;
      if (u) {
        const nick = (c.nickname || "").toLowerCase();
        const uname = (c.username || "").toLowerCase();
        if (!nick.includes(u) && !uname.includes(u)) return false;
      }
      return true;
    });
  }, [comments, search, userFilter]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Comment Log</h2>
        <span className="text-xs text-slate-600 font-mono">{filtered.length} / {comments.length}</span>
      </div>

      <div className="px-4 py-2 border-b border-slate-800 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search text..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
          />
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          placeholder="Filter user..."
          className="w-32 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
        />
      </div>

      <div className="overflow-y-auto max-h-[560px]">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-600 text-sm">
            {comments.length === 0 ? "Waiting for comments..." : "No comments match filter"}
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/50">
            {filtered.map((c, idx) => {
              const normalized = (c.comment || "").trim().toLowerCase();
              const isMatch = normalizedKeywords.has(normalized);
              return (
                <li
                  key={c.id || `live-${idx}-${c.createdAt}`}
                  className={`px-4 py-2 flex items-start gap-2 hover:bg-slate-800/30 transition ${
                    isMatch ? "bg-neon-cyan/10 border-l-2 border-neon-cyan" : ""
                  }`}
                >
                  {c.profilePic ? (
                    <img src={c.profilePic} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      {c.nickname?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-300 truncate max-w-[140px]">
                        {c.nickname || c.username}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600 shrink-0">
                        {formatTime(c.createdAt || c.created_at)}
                      </span>
                      {isMatch && (
                        <span className="text-[10px] font-bold text-neon-cyan uppercase">match</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 break-words">{c.comment}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
