import { Router } from "express";
import { fetchGifts, fetchStats, fetchLeaderboard } from "./db.js";
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

export default router;
