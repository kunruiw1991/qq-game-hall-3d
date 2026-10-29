/**
 * Cross-game progress reader for QQ Game Hall 3D.
 *
 * All four games publish to the shared-origin `localStorage['qq_hall_progress']` key
 * (GitHub Pages serves every game from the same origin) as:
 *   { "<gameId>": { "plays": n, "best": number|string, "stars": 0..3, "last": ISO } }
 *
 * Pure ES2022 module — zero DOM/Three.js imports; tolerates missing/blocked storage.
 */

export const HALL_PROGRESS_KEY = 'qq_hall_progress';

const BEST_LABEL_BY_GAME = Object.freeze({
  tang: '最佳战绩',
  watermelon: '最高分',
  aeroplane: '最佳名次',
  bubbledragon: '最高分',
});

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

/**
 * Reads and normalizes the shared progress map. Never throws.
 * @returns {Record<string, {plays:number, best:number|string|null, stars:number, last:string|null}>}
 */
export function readHallProgress() {
  const storage = safeStorage();
  if (!storage) return {};
  let raw = null;
  try {
    raw = storage.getItem(HALL_PROGRESS_KEY);
  } catch (_) {
    return {};
  }
  if (!raw) return {};
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return {};
  }
  if (!parsed || typeof parsed !== 'object') return {};
  const out = {};
  for (const [gameId, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== 'object') continue;
    const stars = Math.max(0, Math.min(3, Math.floor(Number(entry.stars) || 0)));
    const plays = Math.max(0, Math.floor(Number(entry.plays) || 0));
    const best =
      typeof entry.best === 'number' && Number.isFinite(entry.best)
        ? entry.best
        : typeof entry.best === 'string' && entry.best.trim()
          ? entry.best.trim().slice(0, 24)
          : null;
    const last = typeof entry.last === 'string' ? entry.last : null;
    out[String(gameId)] = { plays, best, stars, last };
  }
  return out;
}

/**
 * Returns the gameId with the most recent `last` timestamp, or null.
 */
export function findLastPlayedGameId(progress = readHallProgress()) {
  let bestId = null;
  let bestTime = -Infinity;
  for (const [gameId, entry] of Object.entries(progress)) {
    if (!entry || !entry.last) continue;
    const t = Date.parse(entry.last);
    if (Number.isFinite(t) && t > bestTime) {
      bestTime = t;
      bestId = gameId;
    }
  }
  return bestId;
}

/**
 * Formats the kid-readable progress line shown under the selected game card.
 * @param {string} gameId
 * @param {object} progress
 */
export function formatProgressLine(gameId, progress = readHallProgress()) {
  const entry = progress[gameId];
  if (!entry || (entry.plays <= 0 && entry.stars <= 0 && entry.best === null)) {
    return { stars: 0, text: '还没玩过 · 快来试试！', isNew: true };
  }
  const starText = '★'.repeat(entry.stars) + '☆'.repeat(3 - entry.stars);
  const parts = [starText];
  if (entry.best !== null) {
    const label = BEST_LABEL_BY_GAME[gameId] || '最佳';
    parts.push(`${label} ${entry.best}`);
  }
  if (entry.plays > 0) {
    parts.push(`玩过 ${entry.plays} 次`);
  }
  return { stars: entry.stars, text: parts.join(' · '), isNew: false };
}
