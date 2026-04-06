import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import db, {
  createSession,
  closeSession,
  saveGift,
  fetchGifts,
  fetchStats,
  fetchLeaderboard,
} from "./db.js";

// Clean up between tests
beforeEach(() => {
  db.exec("DELETE FROM gifts");
  db.exec("DELETE FROM sessions");
});

describe("sessions", () => {
  it("createSession returns a numeric id", () => {
    const id = createSession("testuser");
    assert.equal(typeof id, "number");
    assert.ok(id > 0);
  });

  it("closeSession sets ended_at", () => {
    const id = createSession("testuser");
    closeSession(id);
    const row = db.prepare("SELECT ended_at FROM sessions WHERE id = ?").get(id);
    assert.ok(row.ended_at !== null);
  });
});

describe("gifts", () => {
  it("saveGift returns a numeric id", () => {
    const sessionId = createSession("testuser");
    const id = saveGift({
      username: "gifter1",
      nickname: "Gifter One",
      giftName: "Rose",
      giftId: 5655,
      diamondCount: 1,
      repeatCount: 3,
      profilePic: "https://example.com/pic.jpg",
      sessionId,
    });
    assert.equal(typeof id, "number");
    assert.ok(id > 0);
  });

  it("fetchGifts returns paginated results", () => {
    const sessionId = createSession("testuser");
    for (let i = 0; i < 5; i++) {
      saveGift({
        username: `user${i}`,
        nickname: `User ${i}`,
        giftName: "Rose",
        giftId: 5655,
        diamondCount: 1,
        repeatCount: 1,
        profilePic: null,
        sessionId,
      });
    }

    const result = fetchGifts(1, 3);
    assert.equal(result.gifts.length, 3);
    assert.equal(result.total, 5);
    assert.equal(result.page, 1);
    assert.equal(result.limit, 3);

    const page2 = fetchGifts(2, 3);
    assert.equal(page2.gifts.length, 2);
  });

  it("fetchGifts returns gifts in descending order by created_at", () => {
    const sessionId = createSession("testuser");
    // Insert with explicit distinct timestamps to ensure deterministic ordering
    db.prepare(
      "INSERT INTO gifts (username, nickname, gift_name, gift_id, diamond_count, repeat_count, profile_pic, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("first", "First", "Rose", 5655, 1, 1, null, sessionId, "2024-01-01 00:00:01");
    db.prepare(
      "INSERT INTO gifts (username, nickname, gift_name, gift_id, diamond_count, repeat_count, profile_pic, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("second", "Second", "Lion", 6000, 100, 1, null, sessionId, "2024-01-01 00:00:02");

    const result = fetchGifts(1, 10);
    assert.equal(result.gifts[0].username, "second");
    assert.equal(result.gifts[1].username, "first");
  });
});

describe("stats", () => {
  it("fetchStats returns zeros when no gifts", () => {
    const stats = fetchStats(null);
    assert.equal(stats.allTime.totalGifts, 0);
    assert.equal(stats.allTime.totalCoins, 0);
    assert.equal(stats.session.totalGifts, 0);
    assert.equal(stats.session.totalCoins, 0);
  });

  it("fetchStats calculates coins correctly (diamondCount * repeatCount)", () => {
    const sessionId = createSession("testuser");
    saveGift({ username: "u1", nickname: "U1", giftName: "Rose", giftId: 5655, diamondCount: 10, repeatCount: 5, profilePic: null, sessionId });
    saveGift({ username: "u2", nickname: "U2", giftName: "Lion", giftId: 6000, diamondCount: 100, repeatCount: 2, profilePic: null, sessionId });

    const stats = fetchStats(sessionId);
    assert.equal(stats.allTime.totalGifts, 2);
    assert.equal(stats.allTime.totalCoins, 250); // 10*5 + 100*2
    assert.equal(stats.session.totalGifts, 2);
    assert.equal(stats.session.totalCoins, 250);
  });

  it("fetchStats separates session vs allTime", () => {
    const session1 = createSession("user1");
    saveGift({ username: "u1", nickname: "U1", giftName: "Rose", giftId: 5655, diamondCount: 10, repeatCount: 1, profilePic: null, sessionId: session1 });
    closeSession(session1);

    const session2 = createSession("user2");
    saveGift({ username: "u2", nickname: "U2", giftName: "Lion", giftId: 6000, diamondCount: 50, repeatCount: 1, profilePic: null, sessionId: session2 });

    const stats = fetchStats(session2);
    assert.equal(stats.allTime.totalGifts, 2);
    assert.equal(stats.allTime.totalCoins, 60);
    assert.equal(stats.session.totalGifts, 1);
    assert.equal(stats.session.totalCoins, 50);
  });
});

describe("leaderboard", () => {
  it("returns empty array when no gifts", () => {
    const result = fetchLeaderboard();
    assert.deepEqual(result, []);
  });

  it("returns top gifters sorted by total coins", () => {
    const sessionId = createSession("testuser");
    // User A: 2 gifts, total 30 coins
    saveGift({ username: "userA", nickname: "A", giftName: "Rose", giftId: 5655, diamondCount: 10, repeatCount: 1, profilePic: null, sessionId });
    saveGift({ username: "userA", nickname: "A", giftName: "Rose", giftId: 5655, diamondCount: 10, repeatCount: 2, profilePic: null, sessionId });
    // User B: 1 gift, total 100 coins
    saveGift({ username: "userB", nickname: "B", giftName: "Lion", giftId: 6000, diamondCount: 100, repeatCount: 1, profilePic: null, sessionId });

    const board = fetchLeaderboard();
    assert.equal(board.length, 2);
    assert.equal(board[0].username, "userB");
    assert.equal(board[0].totalCoins, 100);
    assert.equal(board[1].username, "userA");
    assert.equal(board[1].totalCoins, 30);
    assert.equal(board[1].giftCount, 2);
  });

  it("limits to 10 entries", () => {
    const sessionId = createSession("testuser");
    for (let i = 0; i < 15; i++) {
      saveGift({ username: `user${i}`, nickname: `U${i}`, giftName: "Rose", giftId: 5655, diamondCount: i + 1, repeatCount: 1, profilePic: null, sessionId });
    }
    const board = fetchLeaderboard();
    assert.equal(board.length, 10);
    assert.equal(board[0].totalCoins, 15); // highest first
  });
});
