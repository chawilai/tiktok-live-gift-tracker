import { useState } from "react";

export default function LiveEmbed({ username, connected }) {
  const [embedFailed, setEmbedFailed] = useState(false);

  if (!username) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="text-4xl mb-3 opacity-50">📺</div>
        <p className="text-slate-500 text-sm">Enter a username and connect to see the live stream</p>
      </div>
    );
  }

  const liveUrl = `https://www.tiktok.com/@${username}/live`;

  if (embedFailed) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center space-y-3">
        <div className="text-4xl">📺</div>
        <p className="text-slate-300 text-sm font-medium">@{username}</p>
        <p className="text-slate-500 text-xs">Embed not available — TikTok blocks iframe embedding</p>
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded-lg px-4 py-2 text-sm font-medium hover:bg-neon-pink/30 transition"
        >
          Open TikTok Live
        </a>
        {connected && (
          <p className="text-neon-green text-xs flex items-center justify-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            Receiving gifts in real-time
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="aspect-[9/16] max-h-[500px]">
        <iframe
          src={liveUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          onError={() => setEmbedFailed(true)}
          onLoad={(e) => {
            setTimeout(() => setEmbedFailed(true), 3000);
          }}
          title="TikTok Live"
        />
      </div>
    </div>
  );
}
