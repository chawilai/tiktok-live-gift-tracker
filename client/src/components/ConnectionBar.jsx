import { useState } from "react";

export default function ConnectionBar({ status, onConnect, onDisconnect }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onConnect(username.trim().replace("@", ""));
      if (result.error) setError(result.error);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    await onDisconnect();
    setLoading(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">@</span>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="TikTok username"
          disabled={loading || status.connected}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan disabled:opacity-50 w-48"
        />
      </div>

      {!status.connected ? (
        <button
          onClick={handleConnect}
          disabled={loading || !username.trim()}
          className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-neon-cyan/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      ) : (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-red-500/30 transition disabled:opacity-50"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full ${status.connected ? "bg-neon-green animate-pulse" : "bg-slate-600"}`} />
        <span className={status.connected ? "text-neon-green" : "text-slate-500"}>
          {status.connected ? `Connected to @${status.username}` : "Disconnected"}
        </span>
      </div>

      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  );
}
