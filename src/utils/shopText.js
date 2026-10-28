'use strict';
const env = require('../config/env');
const { num, escapeHtml } = require('./format');

let cachedUsername = null;

/** Bot @username (without @): ctx.botInfo, .env, or a one-time getMe(). */
async function botUsernameOf(telegram, botInfo) {
  if (botInfo && botInfo.username) cachedUsername = botInfo.username;
  if (cachedUsername) return cachedUsername;
  if (env.BOT_USERNAME) return env.BOT_USERNAME;
  try {
    const me = await telegram.getMe();
    cachedUsername = me.username;
  } catch {
    cachedUsername = null;
  }
  return cachedUsername;
}

/** Deep link that opens the bot privately on the purchase screen of an item. */
function buyUrl(username, itemKey, groupId) {
  const payload = groupId ? `buy_${groupId}_${itemKey}` : `buy_${itemKey}`;
  return `https://t.me/${username}?start=${payload}`;
}

/**
 * HTML caption of a product (shop post / inline result / private purchase screen).
 * `info` = shopService.getPriceInfo(): { base, final, percent }.
 */
const CAPTION_MAX = 1000; // Telegram: photo captions are capped at 1024 chars (HTML tags don't count, but stay safe)

function productCaption(item, info, { owned = false } = {}) {
  const lines = [`${item.emoji || '📦'} <b>${escapeHtml(item.label)}</b>`];
  const descIndex = lines.length;
  if (item.description) lines.push(escapeHtml(item.description));
  lines.push('');
  if (info.percent > 0) {
    lines.push(`🔥 تخفیف هفته: <b>${info.percent}%</b>`);
    lines.push(`🪙 <s>${num(info.base)}</s> ← <b>${num(info.final)}</b> سکه`);
  } else {
    lines.push(`🪙 قیمت: <b>${num(info.final)}</b> سکه`);
  }
  if (item.dailyLimit) lines.push(`📅 سقف خرید روزانه: ${item.dailyLimit}`);
  if (['CARD', 'DECORATIVE', 'PROFILE_TEMPLATE', 'CHARACTER_UNLOCK', 'CHARACTER_GEAR'].includes(item.category)) lines.push('☝️ یک‌بار قابل خرید');
  if (owned) lines.push('✅ این مورد را از قبل دارید');
  let text = lines.join('\n');
  // A caption over the limit makes Telegram reject the photo (the old "text disappears" bug): trim the description.
  if (item.description && text.length > CAPTION_MAX) {
    const over = text.length - CAPTION_MAX + 1;
    const keep = Math.max(0, escapeHtml(item.description).length - over);
    let desc = escapeHtml(item.description).slice(0, keep).replace(/&[a-z#0-9]*$/i, '');
    desc = keep > 0 ? `${desc.trimEnd()}…` : '';
    lines[descIndex] = desc;
    text = lines.join('\n');
  }
  return text;
}

module.exports = { botUsernameOf, buyUrl, productCaption };
