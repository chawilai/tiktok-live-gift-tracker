import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = `${__dirname}/../data/gifts.db`;

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tiktok_username TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS gifts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    nickname TEXT,
    gift_name TEXT,
    gift_id INTEGER,
    diamond_count INTEGER DEFAULT 0,
    repeat_count INTEGER DEFAULT 1,
    profile_pic TEXT,
    gift_pic TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: add gift_pic column if missing
try {
  db.exec("ALTER TABLE gifts ADD COLUMN gift_pic TEXT");
} catch {
  // column already exists
}

const insertSession = db.prepare(
  "INSERT INTO sessions (tiktok_username) VALUES (?)"
);
const endSession = db.prepare(
  "UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?"
);
const insertGift = db.prepare(`
  INSERT INTO gifts (username, nickname, gift_name, gift_id, diamond_count, repeat_count, profile_pic, gift_pic, session_id)
  VALUES (@username, @nickname, @giftName, @giftId, @diamondCount, @repeatCount, @profilePic, @giftPic, @sessionId)
`);
const getGifts = db.prepare(`
  SELECT * FROM gifts ORDER BY created_at DESC LIMIT ? OFFSET ?
`);
const getGiftCount = db.prepare("SELECT COUNT(*) as count FROM gifts");
const getStats = db.prepare(`
  SELECT
    COUNT(*) as totalGifts,
    COALESCE(SUM(diamond_count * repeat_count), 0) as totalCoins
  FROM gifts
`);
const getSessionStats = db.prepare(`
  SELECT
    COUNT(*) as totalGifts,
    COALESCE(SUM(diamond_count * repeat_count), 0) as totalCoins
  FROM gifts WHERE session_id = ?
`);
const getLeaderboard = db.prepare(`
  SELECT
    nickname,
    username,
    profile_pic as profilePic,
    SUM(diamond_count * repeat_count) as totalCoins,
    COUNT(*) as giftCount
  FROM gifts
  GROUP BY username
  ORDER BY totalCoins DESC
  LIMIT 10
`);

export function createSession(tiktokUsername) {
  const result = insertSession.run(tiktokUsername);
  return result.lastInsertRowid;
}

export function closeSession(sessionId) {
  endSession.run(sessionId);
}

export function saveGift(gift) {
  const result = insertGift.run(gift);
  return result.lastInsertRowid;
}

export function fetchGifts(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const gifts = getGifts.all(limit, offset);
  const { count } = getGiftCount.get();
  return { gifts, total: count, page, limit };
}

export function fetchStats(sessionId) {
  const allTime = getStats.get();
  const session = sessionId ? getSessionStats.get(sessionId) : { totalGifts: 0, totalCoins: 0 };
  return { allTime, session };
}

export function fetchLeaderboard() {
  return getLeaderboard.all();
}

const getPopularGifts = db.prepare(`
  SELECT
    gift_name as giftName,
    gift_id as giftId,
    diamond_count as diamondCount,
    gift_pic as giftPic,
    SUM(repeat_count) as totalCount,
    SUM(diamond_count * repeat_count) as totalCoins
  FROM gifts
  GROUP BY gift_id
  ORDER BY totalCoins DESC
  LIMIT 10
`);

export function fetchPopularGifts() {
  return getPopularGifts.all();
}

// --- Channel-filtered queries ---

const getGiftsByChannel = db.prepare(`
  SELECT g.* FROM gifts g
  JOIN sessions s ON g.session_id = s.id
  WHERE s.tiktok_username = ?
  ORDER BY g.created_at DESC LIMIT ? OFFSET ?
`);
const getGiftCountByChannel = db.prepare(`
  SELECT COUNT(*) as count FROM gifts g
  JOIN sessions s ON g.session_id = s.id
  WHERE s.tiktok_username = ?
`);
const getStatsByChannel = db.prepare(`
  SELECT COUNT(*) as totalGifts, COALESCE(SUM(g.diamond_count * g.repeat_count), 0) as totalCoins
  FROM gifts g JOIN sessions s ON g.session_id = s.id
  WHERE s.tiktok_username = ?
`);
const getLeaderboardByChannel = db.prepare(`
  SELECT g.nickname, g.username, g.profile_pic as profilePic,
    SUM(g.diamond_count * g.repeat_count) as totalCoins, COUNT(*) as giftCount
  FROM gifts g JOIN sessions s ON g.session_id = s.id
  WHERE s.tiktok_username = ?
  GROUP BY g.username ORDER BY totalCoins DESC LIMIT 10
`);
const getPopularGiftsByChannel = db.prepare(`
  SELECT g.gift_name as giftName, g.gift_id as giftId, g.diamond_count as diamondCount,
    g.gift_pic as giftPic, SUM(g.repeat_count) as totalCount,
    SUM(g.diamond_count * g.repeat_count) as totalCoins
  FROM gifts g JOIN sessions s ON g.session_id = s.id
  WHERE s.tiktok_username = ?
  GROUP BY g.gift_id ORDER BY totalCoins DESC LIMIT 10
`);

export function fetchGiftsByChannel(channel, page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  const gifts = getGiftsByChannel.all(channel, limit, offset);
  const { count } = getGiftCountByChannel.get(channel);
  return { gifts, total: count, page, limit };
}

export function fetchStatsByChannel(channel, sessionId) {
  const allTime = getStatsByChannel.get(channel);
  const session = sessionId ? getSessionStats.get(sessionId) : { totalGifts: 0, totalCoins: 0 };
  return { allTime, session };
}

export function fetchLeaderboardByChannel(channel) {
  return getLeaderboardByChannel.all(channel);
}

export function fetchPopularGiftsByChannel(channel) {
  return getPopularGiftsByChannel.all(channel);
}

// --- Triggers ---

db.exec(`
  CREATE TABLE IF NOT EXISTS triggers (
    gift_id INTEGER PRIMARY KEY,
    gift_name TEXT,
    gift_pic TEXT,
    diamond_count INTEGER DEFAULT 0,
    endpoint TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const upsertTrigger = db.prepare(`
  INSERT INTO triggers (gift_id, gift_name, gift_pic, diamond_count, endpoint, enabled)
  VALUES (@giftId, @giftName, @giftPic, @diamondCount, @endpoint, @enabled)
  ON CONFLICT(gift_id) DO UPDATE SET
    endpoint = @endpoint,
    enabled = @enabled,
    gift_name = @giftName,
    gift_pic = @giftPic,
    diamond_count = @diamondCount,
    updated_at = CURRENT_TIMESTAMP
`);
const deleteTrigger = db.prepare("DELETE FROM triggers WHERE gift_id = ?");
const getAllTriggers = db.prepare("SELECT * FROM triggers ORDER BY gift_name");
const getTriggerByGiftId = db.prepare("SELECT * FROM triggers WHERE gift_id = ? AND enabled = 1");

// Get distinct gift types we've seen
const getKnownGifts = db.prepare(`
  SELECT
    gift_id as giftId,
    gift_name as giftName,
    gift_pic as giftPic,
    diamond_count as diamondCount
  FROM gifts
  GROUP BY gift_id
  ORDER BY gift_name
`);

export function saveTrigger(trigger) {
  upsertTrigger.run(trigger);
}

export function removeTrigger(giftId) {
  deleteTrigger.run(giftId);
}

export function fetchTriggers() {
  return getAllTriggers.all();
}

export function fetchTriggerForGift(giftId) {
  return getTriggerByGiftId.get(giftId) || null;
}

export function fetchKnownGifts() {
  return getKnownGifts.all();
}

// --- History ---

const getHistory = db.prepare(`
  SELECT
    s.tiktok_username as username,
    COUNT(DISTINCT s.id) as sessionCount,
    MAX(s.started_at) as lastSeen,
    COALESCE(SUM(g.diamond_count * g.repeat_count), 0) as totalCoins,
    COUNT(g.id) as totalGifts
  FROM sessions s
  LEFT JOIN gifts g ON g.session_id = s.id
  GROUP BY s.tiktok_username
  ORDER BY lastSeen DESC
`);

export function fetchHistory() {
  return getHistory.all();
}

// --- Watchlist ---

db.exec(`
  CREATE TABLE IF NOT EXISTS watchlist (
    username TEXT PRIMARY KEY,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const insertWatch = db.prepare("INSERT OR IGNORE INTO watchlist (username) VALUES (?)");
const deleteWatch = db.prepare("DELETE FROM watchlist WHERE username = ?");
const getAllWatch = db.prepare("SELECT username FROM watchlist ORDER BY added_at");

export function addToWatchlist(username) {
  insertWatch.run(username);
}

export function removeFromWatchlist(username) {
  deleteWatch.run(username);
}

export function fetchWatchlist() {
  return getAllWatch.all().map((r) => r.username);
}

export default db;
