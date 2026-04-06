function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatTHB(coins) {
  const thb = coins / 4;
  if (thb >= 1_000_000) return (thb / 1_000_000).toFixed(1) + "M";
  if (thb >= 1_000) return (thb / 1_000).toFixed(1) + "K";
  return thb.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Card({ label, value, sub, icon, color }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${color}`}>{formatNumber(value)}</p>
      {sub && <p className="text-xs text-yellow-400 font-mono mt-1">{sub}</p>}
    </div>
  );
}

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card label="Total Gifts" value={stats.allTime.totalGifts} icon="🎁" color="text-neon-pink" />
      <Card label="Total Coins" value={stats.allTime.totalCoins} sub={`~${formatTHB(stats.allTime.totalCoins)} ฿`} icon="💎" color="text-neon-cyan" />
      <Card label="Session Gifts" value={stats.session.totalGifts} icon="🎯" color="text-neon-green" />
      <Card label="Session Coins" value={stats.session.totalCoins} sub={`~${formatTHB(stats.session.totalCoins)} ฿`} icon="⚡" color="text-yellow-400" />
    </div>
  );
}
