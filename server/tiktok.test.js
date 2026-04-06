import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getStatus, disconnect } from "./tiktok.js";

describe("tiktok connector", () => {
  it("getStatus returns disconnected state by default", () => {
    const status = getStatus();
    assert.equal(status.connected, false);
    assert.equal(status.username, null);
    assert.equal(status.sessionId, null);
  });

  it("disconnect when not connected returns null", async () => {
    const result = await disconnect();
    assert.equal(result, null);
  });
});
