import { Router } from "express";
import { fetchGifts, fetchStats, fetchLeaderboard, fetchPopularGifts, fetchTriggers, fetchKnownGifts, saveTrigger, removeTrigger, fetchGiftsByChannel, fetchStatsByChannel, fetchLeaderboardByChannel, fetchPopularGiftsByChannel } from "./db.js";
import { getChannelStatus } from "./tiktok.js";

const router = Router();

router.get("/gifts", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const channel = req.query.channel;
  if (channel) {
    res.json(fetchGiftsByChannel(channel, page, limit));
  } else {
    res.json(fetchGifts(page, limit));
  }
});

router.get("/stats", (req, res) => {
  const channel = req.query.channel;
  if (channel) {
    const { sessionId } = getChannelStatus(channel);
    res.json(fetchStatsByChannel(channel, sessionId));
  } else {
    res.json(fetchStats(null));
  }
});

router.get("/leaderboard", (req, res) => {
  const channel = req.query.channel;
  res.json(channel ? fetchLeaderboardByChannel(channel) : fetchLeaderboard());
});

router.get("/popular-gifts", (req, res) => {
  const channel = req.query.channel;
  res.json(channel ? fetchPopularGiftsByChannel(channel) : fetchPopularGifts());
});

// --- Triggers ---

router.get("/triggers", (req, res) => {
  res.json(fetchTriggers());
});

router.get("/known-gifts", (req, res) => {
  res.json(fetchKnownGifts());
});

router.put("/triggers/:giftId", (req, res) => {
  const giftId = parseInt(req.params.giftId);
  const { giftName, giftPic, diamondCount, endpoint, enabled } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: "endpoint is required" });
  }
  saveTrigger({
    giftId,
    giftName: giftName || "",
    giftPic: giftPic || null,
    diamondCount: diamondCount || 0,
    endpoint,
    enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
  });
  res.json({ ok: true });
});

router.delete("/triggers/:giftId", (req, res) => {
  removeTrigger(parseInt(req.params.giftId));
  res.json({ ok: true });
});

export default router;
