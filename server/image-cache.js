import { mkdirSync, existsSync, createWriteStream, readdirSync, openSync, readSync, closeSync, renameSync, unlinkSync } from "fs";
import { dirname, extname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = `${__dirname}/../data/cache`;
const AVATARS_DIR = `${CACHE_DIR}/avatars`;
const GIFTS_DIR = `${CACHE_DIR}/gifts`;

mkdirSync(AVATARS_DIR, { recursive: true });
mkdirSync(GIFTS_DIR, { recursive: true });

function getExt(url) {
  try {
    const path = new URL(url).pathname;
    const ext = extname(path).split("~")[0].split("?")[0];
    return ext || ".webp";
  } catch {
    return ".webp";
  }
}

async function downloadFile(url, filePath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const ws = createWriteStream(filePath);
    await pipeline(res.body, ws);
    return true;
  } catch (e) {
    console.error(`Image cache failed: ${url}`, e.message);
    return false;
  }
}

/**
 * Read width/height from a WebP, JPEG or PNG header. Returns null if unknown.
 */
function getImageSize(filePath) {
  let fd;
  try {
    fd = openSync(filePath, "r");
    const buf = Buffer.alloc(64 * 1024);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const b = buf.subarray(0, n);
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const chunk = b.toString("ascii", 12, 16);
      if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: b.readUIntLE(24, 3) + 1, height: b.readUIntLE(27, 3) + 1 };
    }
    if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {
    // ignore
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  return null;
}

/** Find an already-cached avatar file for a username (any extension). */
function findAvatarFile(username) {
  const prefix = `${username}.`;
  try {
    return readdirSync(AVATARS_DIR).find((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes(".")) || null;
  } catch {
    return null;
  }
}

// HD avatar upgrade: live user messages only carry 72x72/100x100 signed URLs (resizing them
// breaks the signature), so look up avatarLarger (1080x1080) via TikTok's live user API.
const HD_MIN_SIZE = 720;
const HD_CONCURRENCY = 2;
const hdAttempted = new Set();
const hdQueue = [];
let hdActive = 0;
let onAvatarUpgraded = null;

/** Register a callback fired as (username, localUrl) after an avatar is upgraded to HD. */
export function setAvatarUpgradedHandler(fn) {
  onAvatarUpgraded = fn;
}

async function fetchLargeAvatarUrl(username) {
  const res = await fetch(
    `https://www.tiktok.com/api-live/user/room/?aid=1988&sourceType=54&uniqueId=${encodeURIComponent(username)}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  const user = json?.data?.user;
  return user?.avatarLarger || user?.avatarMedium || null;
}

async function upgradeAvatar(username) {
  const existing = findAvatarFile(username);
  if (existing) {
    const size = getImageSize(`${AVATARS_DIR}/${existing}`);
    if (size && Math.min(size.width, size.height) >= HD_MIN_SIZE) return;
  }

  const url = await fetchLargeAvatarUrl(username);
  if (!url) return;

  // Keep the existing filename so consumers' URLs stay valid; otherwise name by remote ext
  const filename = existing || `${username}${getExt(url)}`;
  const filePath = `${AVATARS_DIR}/${filename}`;
  const tmpPath = `${filePath}.tmp`;
  if (!(await downloadFile(url, tmpPath))) {
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return;
  }
  const size = getImageSize(tmpPath);
  const oldSize = existing ? getImageSize(filePath) : null;
  if (!size || (oldSize && size.width <= oldSize.width)) {
    unlinkSync(tmpPath);
    return;
  }
  renameSync(tmpPath, filePath);
  console.log(`Avatar HD [${username}]: ${size.width}x${size.height}`);
  if (onAvatarUpgraded) onAvatarUpgraded(username, `/cache/avatars/${filename}`);
}

function pumpHdQueue() {
  while (hdActive < HD_CONCURRENCY && hdQueue.length) {
    const username = hdQueue.shift();
    hdActive++;
    upgradeAvatar(username)
      .catch((e) => console.error(`Avatar HD failed [${username}]:`, e.message))
      .finally(() => {
        hdActive--;
        pumpHdQueue();
      });
  }
}

/** Queue an HD avatar lookup for a username (at most once per process run). */
export function queueAvatarUpgrade(username) {
  if (!username || hdAttempted.has(username)) return;
  hdAttempted.add(username);
  hdQueue.push(username);
  pumpHdQueue();
}

/**
 * Cache a user's avatar. Returns local URL path.
 * Downloads the (small) event URL immediately if nothing is cached, then queues an HD upgrade
 * that replaces the file in place with a 1080x1080 version when available.
 */
export async function cacheAvatar(username, remoteUrl) {
  if (!remoteUrl || !username) return null;
  const ext = getExt(remoteUrl);
  const filename = `${username}${ext}`;
  const filePath = `${AVATARS_DIR}/${filename}`;
  const localUrl = `/cache/avatars/${filename}`;

  if (existsSync(filePath)) {
    queueAvatarUpgrade(username);
    return localUrl;
  }

  const ok = await downloadFile(remoteUrl, filePath);
  queueAvatarUpgrade(username);
  return ok ? localUrl : null;
}

/**
 * Cache a gift icon. Returns local URL path.
 */
export async function cacheGiftIcon(giftId, remoteUrl) {
  if (!remoteUrl || !giftId) return null;
  const ext = getExt(remoteUrl);
  const filename = `${giftId}${ext}`;
  const filePath = `${GIFTS_DIR}/${filename}`;
  const localUrl = `/cache/gifts/${filename}`;

  if (existsSync(filePath)) return localUrl;

  const ok = await downloadFile(remoteUrl, filePath);
  return ok ? localUrl : null;
}

export { CACHE_DIR, getImageSize };
