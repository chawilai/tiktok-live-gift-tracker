import { mkdirSync, existsSync, createWriteStream } from "fs";
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
 * Cache a user's avatar. Returns local URL path.
 */
export async function cacheAvatar(username, remoteUrl) {
  if (!remoteUrl || !username) return null;
  const ext = getExt(remoteUrl);
  const filename = `${username}${ext}`;
  const filePath = `${AVATARS_DIR}/${filename}`;
  const localUrl = `/cache/avatars/${filename}`;

  if (existsSync(filePath)) return localUrl;

  const ok = await downloadFile(remoteUrl, filePath);
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

export { CACHE_DIR };
