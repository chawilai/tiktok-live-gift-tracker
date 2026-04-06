import { useState, useEffect, useMemo } from "react";

const SORT_OPTIONS = [
  { value: "webhook-price", label: "Webhook first, then price" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "name", label: "Name A-Z" },
];

export default function TriggerSettings() {
  const [knownGifts, setKnownGifts] = useState([]);
  const [triggers, setTriggers] = useState({});
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState({});
  const [lastFired, setLastFired] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("webhook-price");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [giftsRes, triggersRes] = await Promise.all([
      fetch("/api/known-gifts").then((r) => r.json()),
      fetch("/api/triggers").then((r) => r.json()),
    ]);
    setKnownGifts(giftsRes);

    const triggerMap = {};
    const inputMap = {};
    triggersRes.forEach((t) => {
      triggerMap[t.gift_id] = t;
      inputMap[t.gift_id] = t.endpoint;
    });
    setTriggers(triggerMap);
    setInputs((prev) => ({ ...inputMap, ...prev }));
  };

  const filteredGifts = useMemo(() => {
    let list = knownGifts;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (g) =>
          g.giftName.toLowerCase().includes(q) ||
          String(g.diamondCount).includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "webhook-price") {
        const aHas = triggers[a.giftId] ? 1 : 0;
        const bHas = triggers[b.giftId] ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.diamondCount - a.diamondCount;
      }
      if (sortBy === "price-desc") return b.diamondCount - a.diamondCount;
      if (sortBy === "price-asc") return a.diamondCount - b.diamondCount;
      return a.giftName.localeCompare(b.giftName);
    });

    return list;
  }, [knownGifts, triggers, search, sortBy]);

  const handleSave = async (gift) => {
    const endpoint = inputs[gift.giftId]?.trim();
    if (!endpoint) return;
    setSaving((prev) => ({ ...prev, [gift.giftId]: true }));
    await fetch(`/api/triggers/${gift.giftId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        giftName: gift.giftName,
        giftPic: gift.giftPic,
        diamondCount: gift.diamondCount,
        endpoint,
        enabled: true,
      }),
    });
    setTriggers((prev) => ({
      ...prev,
      [gift.giftId]: { gift_id: gift.giftId, endpoint, enabled: 1 },
    }));
    setSaving((prev) => ({ ...prev, [gift.giftId]: false }));
  };

  const handleDelete = async (giftId) => {
    await fetch(`/api/triggers/${giftId}`, { method: "DELETE" });
    setTriggers((prev) => {
      const next = { ...prev };
      delete next[giftId];
      return next;
    });
    setInputs((prev) => {
      const next = { ...prev };
      delete next[giftId];
      return next;
    });
  };

  const handleTest = async (gift) => {
    const endpoint = triggers[gift.giftId]?.endpoint;
    if (!endpoint) return;
    const payload = {
      timestamp: new Date().toISOString(),
      user: "test_user",
      username: "test_user",
      giftName: gift.giftName,
      giftId: gift.giftId,
      diamondCount: gift.diamondCount,
      repeatCount: 1,
      totalCoins: gift.diamondCount,
      thb: gift.diamondCount / 4,
      _test: true,
    };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setLastFired({ giftId: gift.giftId, status: res.status, ok: res.ok });
    } catch (e) {
      setLastFired({ giftId: gift.giftId, status: e.message, ok: false });
    }
    setTimeout(() => setLastFired(null), 3000);
  };

  if (knownGifts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <p className="text-slate-500 text-sm">Connect to a live stream first to see available gifts</p>
      </div>
    );
  }

  const configuredCount = Object.keys(triggers).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Trigger Settings</h2>
          <span className="text-xs text-slate-600 font-mono">
            {configuredCount} configured / {knownGifts.length} gifts
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Set API endpoints for each gift. When received, a POST request with gift details is sent to the endpoint.
        </p>

        {/* Search + Sort */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gift name or price..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neon-cyan"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {filteredGifts.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No gifts match "{search}"</p>
          ) : (
            filteredGifts.map((gift) => {
              const trigger = triggers[gift.giftId];
              const isSaving = saving[gift.giftId];
              const fired = lastFired?.giftId === gift.giftId ? lastFired : null;

              return (
                <div
                  key={gift.giftId}
                  className={`rounded-lg px-3 py-3 transition ${
                    trigger ? "bg-slate-800/80 border border-neon-cyan/20" : "bg-slate-800/30 border border-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Gift info */}
                    <div className="flex items-center gap-2 min-w-[160px]">
                      {gift.giftPic ? (
                        <img src={gift.giftPic} alt="" className="w-7 h-7 object-contain" />
                      ) : (
                        <span className="text-lg">🎁</span>
                      )}
                      <div>
                        <p className="text-sm font-medium text-neon-pink">{gift.giftName}</p>
                        <p className="text-xs text-slate-500 font-mono">{gift.diamondCount.toLocaleString()} coins</p>
                      </div>
                    </div>

                    {/* Endpoint input */}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={inputs[gift.giftId] || ""}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [gift.giftId]: e.target.value }))
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleSave(gift)}
                        placeholder="https://your-api.com/webhook"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(gift)}
                        disabled={isSaving || !inputs[gift.giftId]?.trim()}
                        className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-neon-cyan/30 transition disabled:opacity-30"
                      >
                        {isSaving ? "..." : "Save"}
                      </button>

                      {trigger && (
                        <>
                          <button
                            onClick={() => handleTest(gift)}
                            className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-yellow-500/30 transition"
                          >
                            Test
                          </button>
                          <button
                            onClick={() => handleDelete(gift.giftId)}
                            className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-2 py-1.5 text-xs hover:bg-red-500/30 transition"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status feedback */}
                  {fired && (
                    <div className={`mt-2 text-xs ${fired.ok ? "text-neon-green" : "text-red-400"}`}>
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
  "timestamp": "2026-04-06T21:30:00.000Z",
  "user": "nickname",
  "username": "tiktok_id",
  "giftName": "Rose",
  "giftId": 5655,
  "diamondCount": 1,
  "repeatCount": 5,
  "totalCoins": 5,
  "thb": 1.25
}`}</pre>
      </div>
    </div>
  );
}
