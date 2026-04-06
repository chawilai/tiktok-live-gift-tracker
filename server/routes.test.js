import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import routes from "./routes.js";
import db from "./db.js";

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", routes);

  const httpServer = createServer(app);
  new Server(httpServer, { cors: { origin: "*" } });

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const { port } = httpServer.address();
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
  server = httpServer;
});

after(() => {
  server?.close();
});

beforeEach(() => {
  db.exec("DELETE FROM gifts");
  db.exec("DELETE FROM sessions");
});

describe("GET /api/status", () => {
  it("returns disconnected status", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.connected, false);
  });
});

describe("GET /api/gifts", () => {
  it("returns empty gifts list", async () => {
    const res = await fetch(`${baseUrl}/api/gifts`);
    const body = await res.json();
    assert.equal(body.gifts.length, 0);
    assert.equal(body.total, 0);
  });

  it("respects pagination params", async () => {
    const res = await fetch(`${baseUrl}/api/gifts?page=1&limit=10`);
    const body = await res.json();
    assert.equal(body.page, 1);
    assert.equal(body.limit, 10);
  });

  it("caps limit at 200", async () => {
    const res = await fetch(`${baseUrl}/api/gifts?limit=500`);
    const body = await res.json();
    assert.equal(body.limit, 200);
  });
});

describe("GET /api/stats", () => {
  it("returns zero stats when empty", async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    const body = await res.json();
    assert.equal(body.allTime.totalGifts, 0);
    assert.equal(body.allTime.totalCoins, 0);
  });
});

describe("GET /api/leaderboard", () => {
  it("returns empty array when no gifts", async () => {
    const res = await fetch(`${baseUrl}/api/leaderboard`);
    const body = await res.json();
    assert.deepEqual(body, []);
  });
});
