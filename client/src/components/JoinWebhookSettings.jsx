import { useState, useEffect } from "react";

export default function JoinWebhookSettings() {
  const [url, setUrl] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetch("/api/settings/join-webhook").then((r) => r.json()).then((d) => {
      setUrl(d.url || "");
      setSaved(d.url || "");
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/settings/join-webhook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    });
    setSaved(url.trim());
    setSaving(false);
  };

  const handleTest = async () => {
    if (!saved) return;
    const payload = {
      timestamp: new Date().toISOString(),
      channel: "test_channel",
      user: "Test User",
      username: "test_user",
      userId: "0",
      profilePic: null,
      _test: true,
    };
    try {
      const res = await fetch(saved, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTestResult({ ok: res.ok, status: res.status });
    } catch (e) {
      setTestResult({ ok: false, status: e.message });
    }
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleClear = async () => {
    setUrl("");
    await fetch("/api/settings/join-webhook", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "" }),
    });
    setSaved("");
  };

  const isDirty = url.trim() !== saved;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Join Webhook</h2>
          <span className={`text-xs font-mono ${saved ? "text-neon-green" : "text-slate-600"}`}>
            {saved ? "active" : "not configured"}
          </span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Fires a POST request on every viewer join across all channels. The endpoint receives user info and can check VIP status, trigger a robot arm, or do anything else.
        </p>

        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="https://your-api.com/join-webhook"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-neon-cyan"
          />
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-4 py-1.5 text-xs font-medium hover:bg-neon-cyan/30 transition disabled:opacity-30"
          >
            {saving ? "..." : "Save"}
          </button>
          {saved && (
            <>
              <button
                onClick={handleTest}
                className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-yellow-500/30 transition"
              >
                Test
              </button>
              <button
                onClick={handleClear}
                className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-3 py-1.5 text-xs hover:bg-red-500/30 transition"
              >
                Clear
              </button>
            </>
          )}
        </div>

        {testResult && (
          <div className={`text-xs ${testResult.ok ? "text-neon-green" : "text-red-400"}`}>
            Test: {testResult.ok ? `OK (${testResult.status})` : `Failed — ${testResult.status}`}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payload Format (POST JSON)</h3>
        <pre className="text-xs text-slate-400 font-mono bg-slate-900 rounded-lg p-3 overflow-x-auto">{`{
  "timestamp": "2026-04-15T21:30:00.000Z",
  "channel": "boomjobjab",
  "user": "nickname",
  "username": "tiktok_id",
  "userId": "1234567890",
  "profilePic": "https://..."
}`}</pre>
      </div>
    </div>
  );
}
