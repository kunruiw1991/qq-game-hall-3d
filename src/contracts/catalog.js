/**
 * Game Catalog, Canonical URLs, and Constants for
 * QQ Game Hall 3D (QQ游戏大厅 3D — 童年四大经典合集).
 *
 * Pure ES2022 module — zero external dependencies.
 */

export const FIXED_DT = 1 / 60;
export const MAX_ACCUMULATOR_SEC = 0.25;
export const CAROUSEL_RADIUS = 6.6;

export const UI_MODES = Object.freeze({
  HALL: 'hall',
  EMBEDDED: 'embedded',
});

export const TEST_IDS = Object.freeze({
  PLAZA_CANVAS: 'plaza-canvas',
  BTN_PREV_GAME: 'btn-prev-game',
  BTN_PLAY_EMBEDDED: 'btn-play-embedded',
  BTN_NEXT_GAME: 'btn-next-game',
  BTN_OPEN_STANDALONE: 'btn-open-standalone',
  BTN_AUDIO_MUTE: 'btn-audio-mute',
  EMBEDDED_IFRAME: 'embedded-game-iframe',
  BTN_RETURN_HALL: 'btn-return-hall',
  BTN_EMBEDDED_STANDALONE: 'btn-embedded-standalone',
});

export const GAME_CATALOG = Object.freeze([
  Object.freeze({
    id: 'tang',
    index: 0,
    slug: 'qq-tang-3d',
    hash: '#tang',
    aliases: Object.freeze(['tang', 'qq-tang-3d', 'qqtang', 'qq_tang_3d', '0']),
    titleZh: 'QQ堂 3D',
    titleEn: 'QQ Tang: Candy Bubble Arena 3D',
    subtitleZh: '糖果水泡大乱斗 · 抢包山 · 机械傀儡 Boss',
    badgeZh: '经典乱斗',
    liveUrl: 'https://kunruiw1991.github.io/qq-tang-3d/',
    repoUrl: 'https://github.com/kunruiw1991/qq-tang-3d',
    themeColor: '#38bdf8',
    accentColor: '#f472b6',
    pedestalHex: 0x38bdf8,
    rimHex: 0xf472b6,
    baseAngle: 0,
    dioramaSummary: '3D Chibi MiDuo & Bouncing Translucent Sugar Bubbles with 4-Way Water Blast',
  }),
  Object.freeze({
    id: 'watermelon',
    index: 1,
    slug: 'qq-watermelon-3d',
    hash: '#watermelon',
    aliases: Object.freeze(['watermelon', 'qq-watermelon-3d', 'qq_watermelon_3d', 'fruit', '1']),
    titleZh: '合成大西瓜 3D',
    titleEn: 'Synthetic Big Watermelon 3D',
    subtitleZh: '11阶3D水果物理碰撞 · 摇一摇 · 金西瓜喷泉',
    badgeZh: '物理合成',
    liveUrl: 'https://kunruiw1991.github.io/qq-watermelon-3d/',
    repoUrl: 'https://github.com/kunruiw1991/qq-watermelon-3d',
    themeColor: '#22c55e',
    accentColor: '#fb7185',
    pedestalHex: 0x22c55e,
    rimHex: 0xfb7185,
    baseAngle: Math.PI * 0.5,
    dioramaSummary: 'Translucent Crystal Jar with Tumbling 3D Big Watermelon, Half-Melon & Fruits',
  }),
  Object.freeze({
    id: 'aeroplane',
    index: 2,
    slug: 'qq-aeroplane-chess-3d',
    hash: '#aeroplane',
    aliases: Object.freeze([
      'aeroplane',
      'qq-aeroplane-chess-3d',
      'qq_aeroplane_chess_3d',
      'aeroplanechess',
      'chess',
      'ludo',
      '2',
    ]),
    titleZh: 'QQ飞行棋 3D',
    titleEn: 'QQ Aeroplane Chess 3D',
    subtitleZh: '四色3D双翼机 · 同色跳棋 · 虚线飞棋航线',
    badgeZh: '策略棋盘',
    liveUrl: 'https://kunruiw1991.github.io/qq-aeroplane-chess-3d/',
    repoUrl: 'https://github.com/kunruiw1991/qq-aeroplane-chess-3d',
    themeColor: '#f59e0b',
    accentColor: '#3b82f6',
    pedestalHex: 0xf59e0b,
    rimHex: 0x3b82f6,
    baseAngle: Math.PI,
    dioramaSummary: '4-Color 3D Cross Board with 4 Banking Biplanes Circling a Tumbling 3D Die',
  }),
  Object.freeze({
    id: 'bubbledragon',
    index: 3,
    slug: 'qq-bubble-dragon-3d',
    hash: '#bubbledragon',
    aliases: Object.freeze([
      'bubbledragon',
      'qq-bubble-dragon-3d',
      'qq_bubble_dragon_3d',
      'bubble-dragon',
      'bubble',
      'bobble',
      '3',
    ]),
    titleZh: 'QQ泡泡龙 3D',
    titleEn: 'QQ Bubble Dragon Shooter 3D',
    subtitleZh: '齿轮泡泡大炮 · 墙壁反弹 · 悬空雪崩掉落',
    badgeZh: '瞄准消除',
    liveUrl: 'https://kunruiw1991.github.io/qq-bubble-dragon-3d/',
    repoUrl: 'https://github.com/kunruiw1991/qq-bubble-dragon-3d',
    themeColor: '#a855f7',
    accentColor: '#facc15',
    pedestalHex: 0xa855f7,
    rimHex: 0xfacc15,
    baseAngle: Math.PI * 1.5,
    dioramaSummary: 'Geared Brass Bubble Cannon + Chibi Dragon Popping Rainbow Hex Bubbles',
  }),
]);

export const GAME_IDS = Object.freeze(GAME_CATALOG.map((g) => g.id));

export const GAME_BY_ID = Object.freeze(
  Object.fromEntries(GAME_CATALOG.map((g) => [g.id, g]))
);

/**
 * Resolves any game identifier (canonical id, repo slug, URL hash, or index 0..3)
 * to its canonical game entry from GAME_CATALOG, or null if unrecognized.
 *
 * @param {string|number|null|undefined} rawInput
 * @returns {object|null}
 */
export function resolveGameEntry(rawInput) {
  if (rawInput === null || rawInput === undefined) return null;
  if (typeof rawInput === 'number' && Number.isFinite(rawInput)) {
    const idx = ((Math.trunc(rawInput) % GAME_CATALOG.length) + GAME_CATALOG.length) % GAME_CATALOG.length;
    return GAME_CATALOG[idx] || null;
  }
  const cleaned = String(rawInput)
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/^\/+|\/+$/g, '');
  if (!cleaned) return null;

  for (let i = 0; i < GAME_CATALOG.length; i += 1) {
    const g = GAME_CATALOG[i];
    if (g.id === cleaned || g.slug === cleaned || g.aliases.includes(cleaned)) {
      return g;
    }
  }
  return null;
}
