import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";
import { connectChannel, disconnectChannel, getChannelStatus, getAllChannels } from "./tiktok.js";
import { createSession, closeSession, saveGift, fetchTriggerForGift, saveComment, fetchCommentTriggerByKeyword, saveJoin, getAppSetting } from "./db.js";
import { cacheAvatar, cacheGiftIcon, CACHE_DIR } from "./image-cache.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());
app.use("/cache", express.static(CACHE_DIR, { maxAge: "7d" }));
app.use("/api", routes);

// List all active channels
app.get("/api/channels", (req, res) => {
  res.json(getAllChannels());
});

// Get single channel status
app.get("/api/channels/:username/status", (req, res) => {
  res.json(getChannelStatus(req.params.username));
});

app.post("/api/connect", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }

  try {
    await connectChannel(username, {
      onSessionId: (u) => {
        const { roomInfo } = getChannelStatus(u);
        const id = createSession(u, roomInfo?.nickname, roomInfo?.profilePic);
        const status = getChannelStatus(u);
        io.emit("channel:status", status);
        // Cache streamer avatar in background
        if (roomInfo?.profilePic) cacheAvatar(u, roomInfo.profilePic);
        return id;
      },
      onGift: (data, channel) => {
        const { sessionId } = getChannelStatus(channel);
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

        const isStreak = data.giftType === 1;

        if (isStreak && !data.repeatEnd) {
          io.emit("gift:streak", { ...gift, channel, createdAt: new Date().toISOString() });
          return;
        }

        const id = saveGift(gift);
        const createdAt = new Date().toISOString();
        io.emit("gift", { id, ...gift, channel, createdAt });

        // Cache images in background
        if (gift.profilePic) cacheAvatar(gift.username, gift.profilePic);
        if (gift.giftPic) cacheGiftIcon(gift.giftId, gift.giftPic);

        // Fire trigger if configured
        const trigger = fetchTriggerForGift(gift.giftId);
        if (trigger) {
          const payload = {
            timestamp: createdAt,
            channel,
            user: gift.nickname,
            username: gift.username,
            giftName: gift.giftName,
            giftId: gift.giftId,
            diamondCount: gift.diamondCount,
            repeatCount: gift.repeatCount,
            totalCoins: gift.diamondCount * gift.repeatCount,
            thb: (gift.diamondCount * gift.repeatCount) / 4,
          };
          fetch(trigger.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then((r) => console.log(`Trigger [${channel}]: ${gift.giftName} → ${trigger.endpoint} (${r.status})`))
            .catch((e) => console.error(`Trigger failed [${channel}]: ${e.message}`));
          io.emit("trigger:fired", { giftId: gift.giftId, giftName: gift.giftName, endpoint: trigger.endpoint, channel });
        }
      },
      onChat: (data, channel) => {
        const { sessionId } = getChannelStatus(channel);
        const comment = {
          sessionId,
          username: data.uniqueId,
          nickname: data.nickname,
          profilePic: data.profilePictureUrl,
          comment: data.comment,
        };

        let id = null;
        try {
          id = saveComment(comment);
        } catch (e) {
          console.error(`Save comment failed [${channel}]:`, e.message);
        }

        const createdAt = new Date().toISOString();
        io.emit("comment", { id, ...comment, channel, createdAt });

        if (comment.profilePic) cacheAvatar(comment.username, comment.profilePic);

        // Check comment trigger — exact whole-comment match (case-insensitive, trimmed)
        const normalized = (data.comment || "").trim().toLowerCase();
        if (normalized) {
          const trigger = fetchCommentTriggerByKeyword(normalized);
          if (trigger) {
            const payload = {
              timestamp: createdAt,
              channel,
              user: comment.nickname,
              username: comment.username,
              comment: data.comment,
              keyword: trigger.keyword,
              label: trigger.label,
            };
            fetch(trigger.endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then((r) => console.log(`Comment trigger [${channel}]: "${normalized}" → ${trigger.endpoint} (${r.status})`))
              .catch((e) => console.error(`Comment trigger failed [${channel}]: ${e.message}`));
            io.emit("comment-trigger:fired", { keyword: trigger.keyword, label: trigger.label, endpoint: trigger.endpoint, user: comment.nickname, username: comment.username, channel });
          }
        }
      },
      onMember: (data, channel) => {
        const { sessionId } = getChannelStatus(channel);
        const join = {
          sessionId,
          username: data.uniqueId,
          nickname: data.nickname,
          profilePic: data.profilePictureUrl,
          userId: data.userId ? String(data.userId) : null,
        };

        let id = null;
        try {
          id = saveJoin(join);
        } catch (e) {
          console.error(`Save join failed [${channel}]:`, e.message);
        }

        const createdAt = new Date().toISOString();
        io.emit("join", { id, ...join, channel, createdAt });

        if (join.profilePic) cacheAvatar(join.username, join.profilePic);

        // Fire global join webhook if configured
        const url = getAppSetting("join_webhook_url");
        if (url) {
          const payload = {
            timestamp: createdAt,
            channel,
            user: join.nickname,
            username: join.username,
            userId: join.userId,
            profilePic: join.profilePic,
          };
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then((r) => console.log(`Join webhook [${channel}]: ${join.username} → ${url} (${r.status})`))
            .catch((e) => console.error(`Join webhook failed [${channel}]: ${e.message}`));
        }
      },
      onViewerUpdate: (count, channel) => {
        io.emit("channel:viewers", { username: channel, viewerCount: count });
      },
      onDisconnect: (oldSessionId, channel) => {
        if (oldSessionId) closeSession(oldSessionId);
        io.emit("channel:status", { connected: false, username: channel, sessionId: null, roomInfo: null });
      },
    });
    res.json(getChannelStatus(username));
  } catch (err) {
    console.error("Connect error:", err);
    const raw = err?.message || String(err) || "Failed to connect";
    // Friendly error messages
    let message = raw;
    if (raw.includes("isn't online") || raw.includes("Unexpected server response")) {
      message = "User is not live right now";
    } else if (raw.includes("Sign Error") || raw.includes("503")) {
      message = "TikTok server temporarily unavailable, try again";
    }
    res.status(500).json({ error: message });
  }
});

app.post("/api/disconnect", async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "username is required" });
  }
  const oldSessionId = await disconnectChannel(username);
  if (oldSessionId) closeSession(oldSessionId);
  io.emit("channel:status", { connected: false, username, sessionId: null, roomInfo: null });
  res.json({ connected: false, username });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
