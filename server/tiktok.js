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

export async function connectChannel(username, { onGift, onChat, onDisconnect, onSessionId }) {
  // Disconnect existing connection for this username if any
  if (channels.has(username)) {
    await disconnectChannel(username);
  }

  const connection = new WebcastPushConnection(username);
  const ch = { connection, sessionId: null, isConnected: false, roomInfo: null };

  try {
    const state = await connection.connect();
    ch.isConnected = true;
    ch.roomInfo = {
      title: state?.roomInfo?.title || "",
      viewerCount: state?.roomInfo?.user_count || 0,
      profilePic: state?.roomInfo?.owner?.avatar_thumb?.url_list?.[0] || null,
      nickname: state?.roomInfo?.owner?.nickname || username,
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
