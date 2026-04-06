import { WebcastPushConnection } from "tiktok-live-connector";

let connection = null;
let currentUsername = null;
let sessionId = null;

export function getStatus() {
  return {
    connected: connection !== null && connection.getState().isConnected,
    username: currentUsername,
    sessionId,
  };
}

export async function connect(username, { onGift, onChat, onDisconnect, onSessionId }) {
  if (connection) {
    await disconnect();
  }

  currentUsername = username;
  connection = new WebcastPushConnection(username);

  try {
    await connection.connect();
  } catch (err) {
    connection = null;
    currentUsername = null;
    throw err;
  }

  if (onSessionId) {
    sessionId = onSessionId(username);
  }

  connection.on("gift", (data) => {
    if (onGift) onGift(data);
  });

  connection.on("chat", (data) => {
    if (onChat) onChat(data);
  });

  connection.on("disconnected", () => {
    connection = null;
    const oldSessionId = sessionId;
    sessionId = null;
    if (onDisconnect) onDisconnect(oldSessionId);
  });

  connection.on("error", (err) => {
    console.error("TikTok WebSocket error:", err.message);
  });

  return { connected: true, username };
}

export async function disconnect() {
  const oldSessionId = sessionId;
  if (connection) {
    try {
      connection.disconnect();
    } catch {
      // ignore disconnect errors
    }
    connection = null;
    currentUsername = null;
    sessionId = null;
  }
  return oldSessionId;
}
