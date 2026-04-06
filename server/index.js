import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";
import { connect, disconnect, getStatus } from "./tiktok.js";
import { createSession, closeSession, saveGift } from "./db.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.post("/api/connect", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  try {
    await connect(username, {
      onSessionId: (u) => {
        const id = createSession(u);
        const { roomInfo } = getStatus();
        io.emit("status", { connected: true, username: u, roomInfo });
        return id;
      },
      onGift: (data) => {
        const { sessionId } = getStatus();
        const gift = {
          username: data.uniqueId,
          nickname: data.nickname,
          giftName: data.giftName,
          giftId: data.giftId,
          diamondCount: data.diamondCount,
          repeatCount: data.repeatCount,
          profilePic: data.profilePictureUrl,
          giftPic: data.giftPictureUrl || null,
          sessionId,
        };

        // Streak gifts (giftType === 1): save only on repeatEnd
        // Non-streak gifts: save immediately
        const isStreak = data.giftType === 1;

        if (isStreak && !data.repeatEnd) {
          // Streak in progress — show on UI but don't save to DB yet
          io.emit("gift:streak", { ...gift, createdAt: new Date().toISOString() });
          return;
        }

        // Final streak event or non-streak gift — save to DB
        const id = saveGift(gift);
        io.emit("gift", { id, ...gift, createdAt: new Date().toISOString() });
      },
      onChat: (data) => {
        io.emit("chat", {
          nickname: data.nickname,
          comment: data.comment,
          profilePic: data.profilePictureUrl,
        });
      },
      onDisconnect: (oldSessionId) => {
        if (oldSessionId) closeSession(oldSessionId);
        io.emit("status", { connected: false, username: null });
      },
    });
    res.json({ connected: true, username });
  } catch (err) {
    console.error("Connect error:", err);
    const message = err?.message || String(err) || "Failed to connect";
    res.status(500).json({ error: message });
  }
});

app.post("/api/disconnect", async (req, res) => {
  const oldSessionId = await disconnect();
  if (oldSessionId) closeSession(oldSessionId);
  io.emit("status", { connected: false, username: null });
  res.json({ connected: false });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
