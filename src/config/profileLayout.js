'use strict';
const C = require('./constants');

/**
 * Profile card layout for the 1280x720 (16:9) template images.
 *
 * The AI-generated templates use three empty zones across the upper area:
 *
 *   [ AVATAR ]      [ HEADER ]      [ LEVEL ]
 *
 * The actual template images are 16:9, so all coordinates are scaled
 * automatically when another 16:9 output size is used.
 */
const BASE_W = 1280;
const BASE_H = 720;

const LAYOUT = {
  width: C.PROFILE_CARD_WIDTH,
  height: C.PROFILE_CARD_HEIGHT,

  drawPanelsOnTemplates: true,

  baseWidth: BASE_W,
  baseHeight: BASE_H,

  // ============================================================
  // Measured on the DEFAULT template (1672x940 -> scaled to 1280x720).
  // The three empty zones sit at the top; the character occupies the far left
  // (x < ~300) and the flag the far right (x > ~1070), so every text block
  // below lives in the dark middle band x 310..1070.
  // ============================================================

  // Left circular zone.
  avatar: { cx: 304, cy: 153, r: 98 },

  // Centre rounded-rectangle zone.
  header: {
    panel: { x: 433, y: 78, w: 400, h: 169 },
    cx: 633,
    name: { y: 114, size: 42, maxWidth: 370 },
    username: { y: 155, size: 24, maxWidth: 370 },
    titlePill: { y: 205, h: 34, size: 21, maxWidth: 320 },
  },

  // Right circular zone.
  levelBadge: { cx: 959, cy: 153, r: 102, labelY: 108, labelSize: 22, numberY: 160, numberSize: 68 },

  // Rank + XP bar (under the three zones, centred in the dark band).
  rankStrip: {
    panel: { x: 310, y: 280, w: 760, h: 100 },
    cx: 690,
    rankY: 307,
    rankSize: 30,
    bar: { x: 390, y: 336, w: 600, h: 18 },
    xpTextY: 366,
    xpTextSize: 20,
  },

  // 2 columns x 6 rows.
  stats: {
    panel: { x: 310, y: 395, w: 470, h: 300 },
    startX: 322,
    startY: 403,
    cellW: 215,
    cellH: 44,
    gapX: 10,
    gapY: 4,
    cols: 2,
    labelSize: 20,
    valueSize: 24,
  },

  // 3 showcase squares.
  showcase: {
    panel: { x: 795, y: 395, w: 275, h: 140 },
    headingY: 414,
    headingSize: 18,
    slot: { size: 72, y: 428, xs: [806, 889, 972] },
    labelY: 515,
    labelSize: 14,
    labelMaxWidth: 80,
  },

  // Owned titles strip.
  titles: {
    panel: { x: 795, y: 548, w: 275, h: 56 },
    cx: 932,
    y: 576,
    size: 17,
    maxWidth: 255,
  },
};

/** Persian labels printed on the card. */
const LABELS = {
  level: 'سطح',
  xp: 'تجربه',
  showcase: 'ویترین',
  titles: 'عنوان‌ها',
  noTitle: 'بدون عنوان',
  noTitles: 'هنوز عنوانی نخریده',
  emptySlot: 'خالی',

  stats: {
    attack: 'حمله',
    defense: 'دفاع',
    speed: 'سرعت',
    crit: 'ضربه بحرانی',
    maxHp: 'سلامتی',
    maxStamina: 'استقامت',
    rating: 'امتیاز',
    winRate: 'نرخ پیروزی',
    wins: 'پیروزی',
    losses: 'شکست',
    streak: 'پیروزی متوالی',
    respect: 'احترام اریس',
  },
};

/** Order the 12 stat cells are drawn in (row by row, left to right). */
const STAT_ORDER = [
  'attack',
  'defense',
  'speed',
  'crit',
  'maxHp',
  'maxStamina',
  'rating',
  'winRate',
  'wins',
  'losses',
  'streak',
  'respect',
];

/**
 * Colours per template.
 */
const THEMES = {
  DEFAULT: {
    text: '#ffffff',
    muted: '#c9d2e6',
    accent: '#ffc857',
    barFrom: '#ffc857',
    barTo: '#ff7a3d',
    panel: 'rgba(8,12,28,0.55)',
    panelStroke: 'rgba(255,255,255,0.16)',
    shadow: 'rgba(0,0,0,0.7)',
    bgFrom: '#101a3a',
    bgTo: '#2a1238',
  },

  TPL_FLAME: {
    text: '#fff6ee',
    muted: '#ffd9bf',
    accent: '#ff9f43',
    barFrom: '#ffb347',
    barTo: '#ff3b1f',
    panel: 'rgba(40,6,4,0.55)',
    panelStroke: 'rgba(255,170,90,0.35)',
    shadow: 'rgba(0,0,0,0.75)',
    bgFrom: '#3a0a06',
    bgTo: '#a8210d',
  },

  TPL_FROST: {
    text: '#f2fbff',
    muted: '#cde8f5',
    accent: '#7fd8ff',
    barFrom: '#9be7ff',
    barTo: '#3b8dff',
    panel: 'rgba(5,24,48,0.55)',
    panelStroke: 'rgba(160,225,255,0.35)',
    shadow: 'rgba(0,10,30,0.7)',
    bgFrom: '#0a2a4a',
    bgTo: '#4b8fc2',
  },

  TPL_ROYAL: {
    text: '#fff9e8',
    muted: '#e8dcc0',
    accent: '#f5c542',
    barFrom: '#f5c542',
    barTo: '#b8860b',
    panel: 'rgba(30,8,50,0.58)',
    panelStroke: 'rgba(245,197,66,0.4)',
    shadow: 'rgba(0,0,0,0.75)',
    bgFrom: '#2a0d4a',
    bgTo: '#5b1d86',
  },

  TPL_FOREST: {
    text: '#f6fff2',
    muted: '#d2ecc6',
    accent: '#8be28b',
    barFrom: '#b7f07a',
    barTo: '#2fa84f',
    panel: 'rgba(6,30,14,0.55)',
    panelStroke: 'rgba(160,240,160,0.35)',
    shadow: 'rgba(0,15,5,0.7)',
    bgFrom: '#0b3320',
    bgTo: '#2f7a46',
  },

  TPL_SHADOW: {
    text: '#ffffff',
    muted: '#c9c9d6',
    accent: '#ff3b5c',
    barFrom: '#ff6b81',
    barTo: '#b0102f',
    panel: 'rgba(0,0,0,0.6)',
    panelStroke: 'rgba(255,59,92,0.4)',
    shadow: 'rgba(0,0,0,0.85)',
    bgFrom: '#07070d',
    bgTo: '#2b0a14',
  },
};

function themeFor(templateKey) {
  return THEMES[templateKey] || THEMES.DEFAULT;
}

module.exports = {
  LAYOUT,
  LABELS,
  STAT_ORDER,
  THEMES,
  themeFor,
  BASE_W,
  BASE_H,
};
