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

export async function connectChannel(username, { onGift, onChat, onDisconnect, onSessionId, onViewerUpdate }) {
  // Disconnect existing connection for this username if any
  if (channels.has(username)) {
    await disconnectChannel(username);
  }

  const connection = new WebcastPushConnection(username);
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

  connection.on("roomUser", (data) => {
    const count = data?.viewerCount || data?.topViewers?.length || 0;
    if (ch.roomInfo) ch.roomInfo.viewerCount = count;
    if (onViewerUpdate) onViewerUpdate(count, username);
  });

  connection.on("disconnected", () => {
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
