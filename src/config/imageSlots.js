'use strict';
const fs = require('fs');
const path = require('path');
const itemsCatalog = require('./items.json');

/**
 * Every picture the bot can show is addressed by a "slot key":
 *
 *   tpl:DEFAULT        free profile-card background
 *   tpl:TPL_FLAME      paid profile-card background (= items.json PROFILE_TEMPLATE key)
 *   item:<ITEM_KEY>    product / decorative-item picture (shop posts, inline shop,
 *                      the 3 showcase slots on the profile card)
 *   level:<N>          level-up photo for level N
 *   level:default      level-up photo used when a level has no photo of its own
 *   shop:banner        header picture of the weekly shop post
 *
 * A slot can be filled two ways (see services/imageService.js):
 *   1. a super admin sends the photo to the bot in private (/admin)
 *   2. a file is dropped into /assets (names below) and shipped with the project
 * The admin upload always wins over the file in /assets.
 */

const ASSETS_DIR = path.join(__dirname, '..', '..', 'assets');
const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const KIND_DIRS = { tpl: 'templates', item: 'items', level: 'levels', shop: 'shop', result: 'results' };

// Battle-result card pictures: Eris winning / losing and the card background (docs/BATTLE_RESULT_PROMPTS.md).
const RESULT_NAMES = ['eris_win', 'eris_lose', 'bg'];
const RESULT_LABELS = { eris_win: '😈 اریس برنده (وقتی اریس می‌برد)', eris_lose: '😭 اریس بازنده (وقتی اریس می‌بازد)', bg: '🖼 پس‌زمینهٔ کارت نتیجهٔ نبرد' };
const resultSlot = (name) => `result:${name}`;

const DEFAULT_TEMPLATE_KEY = 'DEFAULT';
const SHOP_BANNER_SLOT = 'shop:banner';
const LEVEL_DEFAULT_SLOT = 'level:default';

const templateSlot = (templateKey) => `tpl:${templateKey}`;
const itemSlot = (itemKey) => `item:${itemKey}`;
const levelSlot = (level) => `level:${level}`;

function parseSlotKey(slotKey) {
  if (typeof slotKey !== 'string') return null;
  const idx = slotKey.indexOf(':');
  if (idx <= 0) return null;
  return { kind: slotKey.slice(0, idx), name: slotKey.slice(idx + 1) };
}

function profileTemplateKeys() {
  return Object.keys(itemsCatalog).filter((k) => itemsCatalog[k].category === 'PROFILE_TEMPLATE');
}

function isValidSlotKey(slotKey) {
  const p = parseSlotKey(slotKey);
  if (!p) return false;
  if (p.kind === 'tpl') return p.name === DEFAULT_TEMPLATE_KEY || profileTemplateKeys().includes(p.name);
  if (p.kind === 'item') return !!itemsCatalog[p.name];
  if (p.kind === 'level') return p.name === 'default' || /^[1-9]\d{0,2}$/.test(p.name);
  if (p.kind === 'shop') return p.name === 'banner';
  if (p.kind === 'result') return RESULT_NAMES.includes(p.name);
  return false;
}

/** Absolute paths where a project file for this slot may live (first existing one wins). */
function assetCandidates(slotKey) {
  const p = parseSlotKey(slotKey);
  if (!p || !KIND_DIRS[p.kind]) return [];
  const dir = path.join(ASSETS_DIR, KIND_DIRS[p.kind]);
  const names = Array.from(new Set([p.name, p.name.toLowerCase()]));
  const out = [];
  for (const name of names) {
    for (const ext of EXTENSIONS) out.push(path.join(dir, `${name}${ext}`));
  }
  return out;
}

/** Slot keys of every file currently present under /assets (used to pre-upload them). */
function listAssetSlotKeys() {
  const keys = [];
  for (const [kind, dirName] of Object.entries(KIND_DIRS)) {
    let files = [];
    try {
      files = fs.readdirSync(path.join(ASSETS_DIR, dirName));
    } catch {
      continue;
    }
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!EXTENSIONS.includes(ext)) continue;
      const base = path.basename(file, path.extname(file));
      // Normalise the file name back to the canonical slot name.
      let name = base;
      if (kind === 'tpl') {
        const all = [DEFAULT_TEMPLATE_KEY, ...profileTemplateKeys()];
        name = all.find((k) => k.toLowerCase() === base.toLowerCase()) || base;
      } else if (kind === 'item') {
        name = Object.keys(itemsCatalog).find((k) => k.toLowerCase() === base.toLowerCase()) || base;
      } else if (kind === 'level') {
        name = base.toLowerCase() === 'default' ? 'default' : base;
      } else if (kind === 'shop' || kind === 'result') {
        name = base.toLowerCase();
      }
      const slotKey = `${kind}:${name}`;
      if (isValidSlotKey(slotKey)) keys.push(slotKey);
    }
  }
  return Array.from(new Set(keys));
}

function listResultSlots() {
  return RESULT_NAMES.map((n) => ({ key: resultSlot(n), label: RESULT_LABELS[n] }));
}

function listTemplateSlots() {
  return [
    { key: templateSlot(DEFAULT_TEMPLATE_KEY), label: '🆓 قالب رایگان (پیش‌فرض)' },
    ...profileTemplateKeys().map((k) => ({
      key: templateSlot(k),
      label: `${itemsCatalog[k].emoji || '🖼'} ${itemsCatalog[k].label}`,
    })),
  ];
}

/** Products shown in the shop / posts. Decorative items are included (they get a photo on the card too). */
function listItemSlots() {
  return Object.entries(itemsCatalog).map(([k, def]) => ({
    key: itemSlot(k),
    label: `${def.emoji || '📦'} ${def.label}`,
    category: def.category,
  }));
}

function slotLabel(slotKey) {
  const p = parseSlotKey(slotKey);
  if (!p) return slotKey;
  if (p.kind === 'tpl') {
    if (p.name === DEFAULT_TEMPLATE_KEY) return '🆓 قالب رایگان (پیش‌فرض)';
    const def = itemsCatalog[p.name];
    return def ? `${def.emoji || '🖼'} ${def.label}` : slotKey;
  }
  if (p.kind === 'item') {
    const def = itemsCatalog[p.name];
    return def ? `${def.emoji || '📦'} ${def.label}` : slotKey;
  }
  if (p.kind === 'level') return p.name === 'default' ? '🆙 عکس پیش‌فرض ارتقای لول' : `🆙 عکس لول ${p.name}`;
  if (p.kind === 'shop') return '🏪 بنر فروشگاه هفتگی';
  if (p.kind === 'result') return RESULT_LABELS[p.name] || slotKey;
  return slotKey;
}

module.exports = {
  ASSETS_DIR,
  DEFAULT_TEMPLATE_KEY,
  SHOP_BANNER_SLOT,
  LEVEL_DEFAULT_SLOT,
  templateSlot,
  itemSlot,
  levelSlot,
  resultSlot,
  listResultSlots,
  parseSlotKey,
  isValidSlotKey,
  assetCandidates,
  listAssetSlotKeys,
  listTemplateSlots,
  listItemSlots,
  profileTemplateKeys,
  slotLabel,
};
