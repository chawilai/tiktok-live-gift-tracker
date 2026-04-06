import { WebcastPushConnection } from "tiktok-live-connector";

// Map of username → { connection, sessionId, isConnected, roomInfo }
const channels = new Map();

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
