'use strict';
const itemsCatalog = require('../config/items.json');

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;

/** Removes emoji/pictographs (the card font has none) and collapses whitespace. */
function stripEmoji(text) {
  return String(text == null ? '' : text).replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Compact display name of a catalog item for tight spots (showcase slot
 * captions, title pill): text inside «», otherwise the label without its
 * generic prefix. «عنوان «شاگرد شمشیر»» -> شاگرد شمشیر.
 */
function shortLabel(itemKey) {
  const def = itemsCatalog[itemKey];
  if (!def) return itemKey;
  const quoted = def.label.match(/«([^»]+)»/);
  if (quoted) return quoted[1].trim();
  return def.label
    .replace(/^قاب پروفایل\s+/, 'قاب ')
    .replace(/^برچسب ایموجی\s+/, 'برچسب ')
    .replace(/^همراه کوچک\s+/, '')
    .replace(/^قالب پروفایل\s+/, '')
    .trim();
}

const isTitleKey = (key) => typeof key === 'string' && key.startsWith('TITLE_') && !!itemsCatalog[key];

module.exports = { stripEmoji, shortLabel, isTitleKey };
