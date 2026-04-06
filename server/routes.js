import { Router } from "express";
import { fetchGifts, fetchStats, fetchLeaderboard, fetchPopularGifts, fetchTriggers, fetchKnownGifts, saveTrigger, removeTrigger } from "./db.js";
import { getStatus } from "./tiktok.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json(getStatus());
});

router.get("/gifts", (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(fetchGifts(page, limit));
});

router.get("/stats", (req, res) => {
  const { sessionId } = getStatus();
  res.json(fetchStats(sessionId));
});

router.get("/leaderboard", (req, res) => {
  res.json(fetchLeaderboard());
});

router.get("/popular-gifts", (req, res) => {
  res.json(fetchPopularGifts());
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
