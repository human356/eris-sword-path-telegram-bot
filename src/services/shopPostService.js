'use strict';
const C = require('../config/constants');
const slots = require('../config/imageSlots');
const shopService = require('../economy/shopService');
const weeklyOfferModel = require('../database/models/weeklyOfferModel');
const decorativeRotationModel = require('../database/models/decorativeRotationModel');
const shopSettingsModel = require('../database/models/shopSettingsModel');
const imageService = require('./imageService');
const { botUsernameOf, buyUrl, productCaption } = require('../utils/shopText');
const { escapeHtml } = require('../utils/format');

/**
 * Weekly shop auto-post. An admin chooses a topic (forum thread) of the group
 * with /shoptopic; from then on the bot posts the week's discounts and the
 * decorative rotation there, once per week (a new post as soon as either the
 * discounts or the rotation changes). Each product is its own photo post with a
 * direct "buy in private chat" button.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const running = new Set();

async function currentPostKey() {
  const [offers, rotation] = await Promise.all([weeklyOfferModel.getActiveOffers(), decorativeRotationModel.getActiveRotation()]);
  return { key: `${offers.id}:${rotation.id}`, offers, rotation };
}

async function sendProduct(telegram, chatId, thread, username, groupId, item) {
  const caption = productCaption(item, item.priceInfo);
  const extra = {
    parse_mode: 'HTML',
    ...thread,
    reply_markup: { inline_keyboard: [[{ text: '🛒 خرید در پیوی ربات', url: buyUrl(username, item.key, groupId) }]] },
  };
  const photo = await imageService.photoFor(slots.itemSlot(item.key)).catch(() => null);
  if (photo) {
    try {
      const msg = await telegram.sendPhoto(chatId, photo.input, { caption, ...extra });
      await photo.remember(msg).catch(() => {});
      return;
    } catch (err) {
      console.error('[shop-post] photo failed, sending text:', item.key, err.message);
    }
  }
  await telegram.sendMessage(chatId, caption, extra);
}

/** Posts the weekly shop into one group (banner + one post per product). */
async function postWeekly(telegram, groupId, threadId = 0) {
  const username = await botUsernameOf(telegram);
  if (!username) throw new Error('bot username unknown (set BOT_USERNAME)');

  const thread = threadId ? { message_thread_id: Number(threadId) } : {};
  const { offers } = await currentPostKey();
  const catalog = await shopService.listShopCatalog();

  const discounted = catalog.filter((i) => i.priceInfo.percent > 0);
  const decorative = catalog.filter((i) => i.category === 'DECORATIVE');
  const products = [...discounted, ...decorative.filter((d) => !discounted.some((x) => x.key === d.key))];

  const days = Math.max(1, Math.ceil((new Date(offers.expires_at).getTime() - Date.now()) / 86400000));
  const headline =
    `🛒 <b>فروشگاه هفتگی اریس</b>\n\n` +
    `🔥 ${discounted.length} تخفیف ویژه و 🎨 ${decorative.length} آیتم تزئینی جدید\n` +
    `⏳ حدود ${days} روز دیگر به‌روز می‌شود.\n\n` +
    `همیشه می‌توانید با نوشتن <code>@${escapeHtml(username)} shop</code> در متن‌باکس گروه، همهٔ محصولات را ببینید.`;

  const banner = await imageService.photoFor(slots.SHOP_BANNER_SLOT).catch(() => null);
  if (banner) {
    try {
      const msg = await telegram.sendPhoto(groupId, banner.input, { caption: headline, parse_mode: 'HTML', ...thread });
      await banner.remember(msg).catch(() => {});
    } catch (err) {
      await telegram.sendMessage(groupId, headline, { parse_mode: 'HTML', ...thread });
    }
  } else {
    await telegram.sendMessage(groupId, headline, { parse_mode: 'HTML', ...thread });
  }

  for (const item of products) {
    await sleep(C.SHOP_POST_SPACING_MS);
    await sendProduct(telegram, groupId, thread, username, groupId, item);
  }
  return products.length;
}

/** Cron: posts to every enabled group that hasn't received this week's shop yet. */
async function sweep(telegram) {
  const { key } = await currentPostKey();
  const due = await shopSettingsModel.listDueGroups(key);
  for (const row of due) {
    const groupId = Number(row.group_id);
    if (running.has(groupId)) continue;
    running.add(groupId);
    try {
      // Mark first: a crash or flood error must not repost the whole shop every sweep.
      await shopSettingsModel.markPosted(groupId, key);
      await postWeekly(telegram, groupId, Number(row.thread_id) || 0);
    } catch (err) {
      console.error(`[shop-post] group ${groupId} failed:`, err.message);
    } finally {
      running.delete(groupId);
    }
  }
}

module.exports = { postWeekly, sweep, currentPostKey };
