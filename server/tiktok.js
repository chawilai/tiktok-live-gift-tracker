import { WebcastPushConnection } from "tiktok-live-connector";

// Map of username → { connection, sessionId, isConnected, roomInfo }
const channels = new Map();

async function fetchProfileInfo(username) {
  try {
    const res = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    const html = await res.text();
    const nickMatch = html.match(/"nickname":"([^"]+)"/);
    const avatarMatch = html.match(/"avatarThumb":"([^"]+)"/);
    const avatar = avatarMatch?.[1]?.replace(/\\u002F/g, "/") || null;
    return {
      nickname: nickMatch?.[1] || null,
      avatar,
    };
  } catch {
    return null;
  }
}

export function getChannelStatus(username) {
  const ch = channels.get(username);
  if (!ch) return { connected: false, username, sessionId: null, roomInfo: null };
  return {
    connected: ch.isConnected,
    username,
    sessionId: ch.sessionId,
    roomInfo: ch.roomInfo,
  };
}

export function getAllChannels() {
  const list = [];
  for (const [username, ch] of channels) {
    list.push({
      username,
      connected: ch.isConnected,
      sessionId: ch.sessionId,
      roomInfo: ch.roomInfo,
    });
  }
  return list;
}

// username → in-flight connect promise, so concurrent connect calls share one connection
const pending = new Map();

// username → { until, failures }: back off after failed connects (30s → 1m → 2m → 5m max),
// since hammering TikTok's room lookup gets this IP blocked (403 / SIGI_STATE errors)
const cooldowns = new Map();
const COOLDOWN_STEPS_MS = [30_000, 60_000, 120_000, 300_000];

export class CooldownError extends Error {
  constructor(retryAfterMs) {
    super(`Connect cooling down, retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "CooldownError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function connectChannel(username, handlers, { force = false } = {}) {
  // Already connected: no-op unless forced (reconnecting replays history and churns sessions)
  if (!force && channels.get(username)?.isConnected) {
    return Promise.resolve({ connected: true, username, alreadyConnected: true });
  }
  if (pending.has(username)) return pending.get(username);

  const cd = cooldowns.get(username);
  if (cd && Date.now() < cd.until) return Promise.reject(new CooldownError(cd.until - Date.now()));

  const p = doConnect(username, handlers)
    .then((result) => {
      cooldowns.delete(username);
      return result;
    })
    .catch((err) => {
      const failures = (cooldowns.get(username)?.failures || 0) + 1;
      const step = COOLDOWN_STEPS_MS[Math.min(failures, COOLDOWN_STEPS_MS.length) - 1];
      cooldowns.set(username, { until: Date.now() + step, failures });
      throw err;
    })
    .finally(() => pending.delete(username));
  pending.set(username, p);
  return p;
}

async function doConnect(username, { onGift, onChat, onMember, onLike, onShare, onFollow, onDisconnect, onSessionId, onViewerUpdate }) {
  // Disconnect existing connection for this username if any
  if (channels.has(username)) {
    const oldSessionId = await disconnectChannel(username);
    if (oldSessionId && onDisconnect) onDisconnect(oldSessionId, username);
  }

  // Skip the backlog of recent messages TikTok sends on connect — it would be re-saved as new rows
  const connection = new WebcastPushConnection(username, { processInitialData: false });
  const ch = { connection, sessionId: null, isConnected: false, roomInfo: null };

  try {
    const state = await connection.connect();
    ch.isConnected = true;
    // roomInfo structure varies — try multiple paths
    const ri = state?.roomInfo;
    const data = ri?.data || ri || {};
    ch.roomInfo = {
      title: data.title || ri?.title || "",
      viewerCount: data.user_count || data.viewerCount || 0,
      profilePic: data.owner?.avatar_thumb?.url_list?.[0] || ri?.owner?.avatar_thumb?.url_list?.[0] || null,
      nickname: data.owner?.nickname || ri?.owner?.nickname || username,
    };

    // If roomInfo is incomplete, fetch from TikTok profile page
    if (ch.roomInfo.nickname === username || !ch.roomInfo.profilePic) {
      fetchProfileInfo(username).then((info) => {
        if (info) {
          if (info.nickname) ch.roomInfo.nickname = info.nickname;
          if (info.avatar) ch.roomInfo.profilePic = info.avatar;
        }
      });
    }
  } catch (err) {
    throw err;
  }

  channels.set(username, ch);

  if (onSessionId) {
    ch.sessionId = onSessionId(username);
  }

  connection.on("gift", (data) => {
    if (onGift) onGift(data, username);
  });

  connection.on("chat", (data) => {
    if (onChat) onChat(data, username);
  });

  connection.on("member", (data) => {
    if (onMember) onMember(data, username);
  });

  connection.on("like", (data) => {
    if (onLike) onLike(data, username);
  });

  connection.on("share", (data) => {
    if (onShare) onShare(data, username);
  });

  connection.on("follow", (data) => {
    if (onFollow) onFollow(data, username);
  });

  connection.on("roomUser", (data) => {
    const count = data?.viewerCount || data?.topViewers?.length || 0;
    if (ch.roomInfo) ch.roomInfo.viewerCount = count;
    if (onViewerUpdate) onViewerUpdate(count, username);
  });

  connection.on("disconnected", () => {
    // Ignore connections that were replaced or disconnected manually
    if (channels.get(username) !== ch) return;
    const oldSessionId = ch.sessionId;
    ch.isConnected = false;
    ch.roomInfo = null;
    ch.sessionId = null;
    if (onDisconnect) onDisconnect(oldSessionId, username);
  });

  connection.on("error", (err) => {
    console.error(`TikTok WebSocket error [${username}]:`, err.message);
  });

  return { connected: true, username };
}

export async function disconnectChannel(username) {
  const ch = channels.get(username);
  if (!ch) return null;
  const oldSessionId = ch.sessionId;
  try {
    ch.connection.disconnect();
  } catch {
    // ignore
  }
  channels.delete(username);
  return oldSessionId;
}
