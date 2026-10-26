'use strict';
const C = require('../../config/constants');
const shopService = require('../../economy/shopService');
const imageService = require('../../services/imageService');
const slots = require('../../config/imageSlots');
const { botUsernameOf, buyUrl, productCaption } = require('../../utils/shopText');

/**
 * Inline shop: typing «@botusername shop» (optionally followed by a search word)
 * in any chat's text box lists the products. Choosing one sends the product
 * photo + description with a button that opens the bot privately on the
 * purchase screen of that item.
 *
 * Telegram only lets inline results use a file_id (never a local file), so a product
 * photo appears as a picture once it's configured (admin upload) or pre-uploaded
 * from /assets (imageService.primeAssets on boot). Products with no picture
 * show up as text results.
 */
const SHOP_WORDS = ['shop', 'store', 'فروشگاه', 'فروشگاه اریس'];

function parseQuery(raw) {
  const q = String(raw || '').trim();
  const lower = q.toLowerCase();
  if (!q) return { search: '' }; // just "@bot " already shows the shop
  for (const word of SHOP_WORDS) {
    if (lower === word) return { search: '' };
    if (lower.startsWith(`${word} `)) return { search: q.slice(word.length).trim() };
  }
  return null;
}

function matches(item, search) {
  if (!search) return true;
  const hay = `${item.label} ${item.description || ''} ${item.key}`.toLowerCase();
  return search.toLowerCase().split(/\s+/).every((part) => hay.includes(part));
}

async function onInlineQuery(ctx) {
  console.log(`[inline-shop] query from ${ctx.from && ctx.from.id}: "${ctx.inlineQuery.query}"`);
  const parsed = parseQuery(ctx.inlineQuery.query);
  if (!parsed) {
    return ctx.answerInlineQuery([], {
      cache_time: 5,
      is_personal: true,
    }).catch(() => {});
  }

  const username = await botUsernameOf(ctx.telegram, ctx.botInfo);
  if (!username) return ctx.answerInlineQuery([], { cache_time: 5 }).catch(() => {});

  const catalog = (await shopService.listShopCatalog()).filter((i) => matches(i, parsed.search));
  const results = [];

  for (const item of catalog.slice(0, C.SHOP_INLINE_MAX_RESULTS)) {
    const caption = productCaption(item, item.priceInfo);
    const markup = {
      inline_keyboard: [[{ text: '🛒 خرید در پیوی ربات', url: buyUrl(username, item.key) }]],
    };
    const priceLine = item.priceInfo.percent > 0
      ? `🔥 ${item.priceInfo.percent}% تخفیف — ${item.priceInfo.final} سکه`
      : `🪙 ${item.priceInfo.final} سکه`;
    const fileId = await imageService.getFileId(slots.itemSlot(item.key)).catch(() => null);

    if (fileId) {
      results.push({
        type: 'photo',
        id: `shop_${item.key}`.slice(0, 64),
        photo_file_id: fileId,
        title: `${item.emoji || ''} ${item.label}`.trim(),
        description: priceLine,
        caption,
        parse_mode: 'HTML',
        reply_markup: markup,
      });
    } else {
      results.push({
        type: 'article',
        id: `shop_${item.key}`.slice(0, 64),
        title: `${item.emoji || ''} ${item.label}`.trim(),
        description: `${priceLine}\n${item.description || ''}`.trim(),
        input_message_content: { message_text: caption, parse_mode: 'HTML' },
        reply_markup: markup,
      });
    }
  }

  await ctx.answerInlineQuery(results, { cache_time: 20, is_personal: false }).catch((err) => {
    console.error('[inline-shop] answerInlineQuery failed:', err.message);
  });
}

function register(bot) {
  bot.on('inline_query', onInlineQuery);
}

module.exports = { register, parseQuery };
