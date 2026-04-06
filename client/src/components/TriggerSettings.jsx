import { useState, useEffect } from "react";

export default function TriggerSettings() {
  const [knownGifts, setKnownGifts] = useState([]);
  const [triggers, setTriggers] = useState({});
  const [inputs, setInputs] = useState({});
  const [saving, setSaving] = useState({});
  const [lastFired, setLastFired] = useState(null);

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Trigger Settings</h2>
        <p className="text-xs text-slate-600 mb-4">
          Set API endpoints for each gift. When received, a POST request with gift details is sent to the endpoint.
        </p>

        <div className="space-y-2">
          {knownGifts.map((gift) => {
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
                      <p className="text-xs text-slate-500">{gift.diamondCount} coins</p>
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
          })}
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
