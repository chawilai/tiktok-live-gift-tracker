import { useState, useEffect } from "react";

export default function CommentTriggerSettings() {
  const [triggers, setTriggers] = useState([]);
  const [label, setLabel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastFired, setLastFired] = useState(null);

  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    const list = await fetch("/api/comment-triggers").then((r) => r.json());
    setTriggers(list);
  };

  const handleAdd = async () => {
    if (!label.trim() || !endpoint.trim()) return;
    setSaving(true);
    await fetch("/api/comment-triggers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), endpoint: endpoint.trim(), enabled: true }),
    });
    setLabel("");
    setEndpoint("");
    await fetchTriggers();
    setSaving(false);
  };

  const handleDelete = async (keyword) => {
    await fetch(`/api/comment-triggers/${encodeURIComponent(keyword)}`, { method: "DELETE" });
    await fetchTriggers();
  };

  const handleTest = async (t) => {
    const payload = {
      timestamp: new Date().toISOString(),
      user: "test_user",
      username: "test_user",
      comment: t.label,
      keyword: t.keyword,
      label: t.label,
      _test: true,
    };
    try {
      const res = await fetch(t.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLastFired({ keyword: t.keyword, status: res.status, ok: res.ok });
    } catch (e) {
      setLastFired({ keyword: t.keyword, status: e.message, ok: false });
    }
    setTimeout(() => setLastFired(null), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Comment Triggers</h2>
          <span className="text-xs text-slate-600 font-mono">{triggers.length} configured</span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Fire a webhook when a comment exactly matches a keyword (case-insensitive, trimmed). Useful for quiz games — every match fires, so the first correct answer wins.
        </p>

        {/* Add new */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Exact keyword (e.g. แมว)"
            className="w-44 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
          />
          <input
            type="text"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="https://your-api.com/webhook"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
          />
          <button
            onClick={handleAdd}
            disabled={saving || !label.trim() || !endpoint.trim()}
            className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-4 py-1.5 text-xs font-medium hover:bg-neon-cyan/30 transition disabled:opacity-30"
          >
            {saving ? "..." : "Add"}
          </button>
        </div>

        {/* List */}
        <div className="space-y-2">
          {triggers.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No triggers yet</p>
          ) : (
            triggers.map((t) => {
              const fired = lastFired?.keyword === t.keyword ? lastFired : null;
              return (
                <div key={t.keyword} className="rounded-lg px-3 py-2 bg-slate-800/80 border border-neon-cyan/20">
                  <div className="flex items-center gap-3">
                    <div className="min-w-[160px]">
                      <p className="text-sm font-medium text-neon-pink">{t.label}</p>
                      <p className="text-[10px] text-slate-500 font-mono">match: "{t.keyword}"</p>
                    </div>
                    <div className="flex-1 text-xs text-slate-400 font-mono truncate">{t.endpoint}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(t)}
                        className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-lg px-3 py-1 text-xs font-medium hover:bg-yellow-500/30 transition"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => handleDelete(t.keyword)}
                        className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-2 py-1 text-xs hover:bg-red-500/30 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {fired && (
                    <div className={`mt-1 text-xs ${fired.ok ? "text-neon-green" : "text-red-400"}`}>
                      Test: {fired.ok ? `OK (${fired.status})` : `Failed — ${fired.status}`}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payload preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payload Format (POST JSON)</h3>
        <pre className="text-xs text-slate-400 font-mono bg-slate-900 rounded-lg p-3 overflow-x-auto">{`{
  "timestamp": "2026-04-15T21:30:00.000Z",
  "channel": "boomjobjab",
  "user": "nickname",
  "username": "tiktok_id",
  "comment": "แมว",
  "keyword": "แมว",
  "label": "แมว"
}`}</pre>
      </div>
    </div>
  );
}
