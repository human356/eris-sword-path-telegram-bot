'use strict';
const C = require('./constants');

/**
 * Where every piece of text / picture goes on the 1280x720 (16:9) profile card.
 *
 * The AI-generated template pictures must leave these zones EMPTY (see
 * docs/AI_IMAGE_PROMPTS.md — it contains the same map in percentages). If your
 * finished template puts a panel somewhere else, edit the numbers below, bump
 * PROFILE_CARD_LAYOUT_VERSION in constants.js (so cached cards are re-drawn) and
 * run `npm run preview:card` to look at the result.
 *
 * All numbers are pixels on a 1280x720 canvas. If you use another size the
 * coordinates are scaled automatically (only the 16:9 shape matters).
 */
const BASE_W = 1280;
const BASE_H = 720;

const LAYOUT = {
  width: C.PROFILE_CARD_WIDTH,
  height: C.PROFILE_CARD_HEIGHT,
  drawPanelsOnTemplates: true, // translucent panels keep the text readable on top of any template picture
  baseWidth: BASE_W,
  baseHeight: BASE_H,

  // Round profile photo (the user's Telegram avatar).
  avatar: { cx: 190, cy: 185, r: 105 },

  // Header block between the avatar and the level badge; all text is centred on cx.
  header: {
    panel: { x: 340, y: 80, w: 640, h: 210 },
    cx: 660,
    name: { y: 140, size: 54, maxWidth: 600 },
    username: { y: 200, size: 28, maxWidth: 600 },
    titlePill: { y: 255, h: 44, size: 28, maxWidth: 420 },
  },

  // Round level badge (right side).
  levelBadge: { cx: 1120, cy: 185, r: 100, labelY: 130, labelSize: 26, numberY: 195, numberSize: 80 },

  // Rank text + XP bar (full-width strip).
  rankStrip: {
    panel: { x: 60, y: 315, w: 1160, h: 115 },
    cx: 640,
    rankY: 345,
    rankSize: 34,
    bar: { x: 200, y: 378, w: 880, h: 20 },
    xpTextY: 415,
    xpTextSize: 22,
  },

  // 3 columns x 4 rows of "label ........ value" cells (bottom-left).
  stats: {
    panel: { x: 60, y: 455, w: 760, h: 225 },
    startX: 80,
    startY: 468,
    cellW: 240,
    cellH: 48,
    gapX: 10,
    gapY: 4,
    cols: 3,
    labelSize: 22,
    valueSize: 26,
  },

  // Showcase: the 3 decorative items the player chose (bottom-right, upper part).
  showcase: {
    panel: { x: 850, y: 455, w: 370, h: 160 },
    headingY: 475,
    headingSize: 20,
    slot: { size: 90, y: 490, xs: [875, 990, 1105] },
    labelY: 596,
    labelSize: 17,
    labelMaxWidth: 112,
  },

  // Strip listing the titles the player owns (bottom-right, lower part).
  titles: { panel: { x: 850, y: 625, w: 370, h: 55 }, cx: 1035, y: 652, size: 20, maxWidth: 350 },
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
  'attack', 'defense', 'speed', 'crit',
  'maxHp', 'maxStamina', 'rating', 'winRate',
  'wins', 'losses', 'streak', 'respect',
];

/**
 * Colours per template. `bg*` are only used when no template picture exists
 * (the built-in fallback background); everything else also applies on top of
 * real template pictures.
 */
const THEMES = {
  DEFAULT: {
    text: '#ffffff', muted: '#c9d2e6', accent: '#ffc857', barFrom: '#ffc857', barTo: '#ff7a3d',
    panel: 'rgba(8,12,28,0.55)', panelStroke: 'rgba(255,255,255,0.16)', shadow: 'rgba(0,0,0,0.7)',
    bgFrom: '#101a3a', bgTo: '#2a1238',
  },
  TPL_FLAME: {
    text: '#fff6ee', muted: '#ffd9bf', accent: '#ff9f43', barFrom: '#ffb347', barTo: '#ff3b1f',
    panel: 'rgba(40,6,4,0.55)', panelStroke: 'rgba(255,170,90,0.35)', shadow: 'rgba(0,0,0,0.75)',
    bgFrom: '#3a0a06', bgTo: '#a8210d',
  },
  TPL_FROST: {
    text: '#f2fbff', muted: '#cde8f5', accent: '#7fd8ff', barFrom: '#9be7ff', barTo: '#3b8dff',
    panel: 'rgba(5,24,48,0.55)', panelStroke: 'rgba(160,225,255,0.35)', shadow: 'rgba(0,10,30,0.7)',
    bgFrom: '#0a2a4a', bgTo: '#4b8fc2',
  },
  TPL_ROYAL: {
    text: '#fff9e8', muted: '#e8dcc0', accent: '#f5c542', barFrom: '#f5c542', barTo: '#b8860b',
    panel: 'rgba(30,8,50,0.58)', panelStroke: 'rgba(245,197,66,0.4)', shadow: 'rgba(0,0,0,0.75)',
    bgFrom: '#2a0d4a', bgTo: '#5b1d86',
  },
  TPL_FOREST: {
    text: '#f6fff2', muted: '#d2ecc6', accent: '#8be28b', barFrom: '#b7f07a', barTo: '#2fa84f',
    panel: 'rgba(6,30,14,0.55)', panelStroke: 'rgba(160,240,160,0.35)', shadow: 'rgba(0,15,5,0.7)',
    bgFrom: '#0b3320', bgTo: '#2f7a46',
  },
  TPL_SHADOW: {
    text: '#ffffff', muted: '#c9c9d6', accent: '#ff3b5c', barFrom: '#ff6b81', barTo: '#b0102f',
    panel: 'rgba(0,0,0,0.6)', panelStroke: 'rgba(255,59,92,0.4)', shadow: 'rgba(0,0,0,0.85)',
    bgFrom: '#07070d', bgTo: '#2b0a14',
  },
};

function themeFor(templateKey) {
  return THEMES[templateKey] || THEMES.DEFAULT;
}

module.exports = { LAYOUT, LABELS, STAT_ORDER, THEMES, themeFor, BASE_W, BASE_H };
