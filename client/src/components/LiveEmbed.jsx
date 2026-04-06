export default function LiveEmbed({ username, connected, roomInfo }) {
  if (!username) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
        <div className="text-4xl mb-3 opacity-50">📺</div>
        <p className="text-slate-500 text-sm">Enter a username and connect to see the live stream</p>
      </div>
    );
  }

  const liveUrl = `https://www.tiktok.com/@${username}/live`;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Profile header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-800">
        {roomInfo?.profilePic ? (
          <div className="relative">
            <img
              src={roomInfo.profilePic}
              alt={username}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-neon-pink"
            />
            {connected && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <span className="text-[6px] font-bold text-white">LIVE</span>
              </span>
            )}
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-lg ring-2 ring-slate-600">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {roomInfo?.nickname || username}
          </p>
          <p className="text-xs text-slate-500">@{username}</p>
        </div>
        {connected && roomInfo?.viewerCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {roomInfo.viewerCount.toLocaleString()} viewers
          </div>
        )}
      </div>

      {/* Room title */}
      {roomInfo?.title && (
        <div className="px-4 py-2 border-b border-slate-800">
          <p className="text-xs text-slate-400 line-clamp-2">{roomInfo.title}</p>
        </div>
      )}

      {/* Action area */}
      <div className="p-5 text-center space-y-3">
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-neon-pink/20 text-neon-pink border border-neon-pink/50 rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-neon-pink/30 transition"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 16.5l6-4.5-6-4.5v9zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
          </svg>
          Watch on TikTok
        </a>
        {connected && (
          <p className="text-neon-green text-xs flex items-center justify-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
            Receiving gifts in real-time
          </p>
        )}
      </div>
    </div>
  );
}
