'use strict';
const C = require('../../config/constants');
const env = require('../../config/env');
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

  const all = (await shopService.listShopCatalog()).filter((i) => matches(i, parsed.search));
  // Telegram shows at most 50 results per answer: page through the catalog with next_offset
  // (the old code cut the list at 50 and silently hid the rest of the shop).
  const pageSize = Math.min(50, C.SHOP_INLINE_MAX_RESULTS || 50);
  const offset = Math.max(0, parseInt(ctx.inlineQuery.offset, 10) || 0);
  const catalog = all.slice(offset, offset + pageSize);
  const nextOffset = offset + pageSize < all.length ? String(offset + pageSize) : '';
  const results = [];

  for (const item of catalog) {
    const caption = productCaption(item, item.priceInfo);
    const markup = {
      inline_keyboard: [[{ text: '🛒 خرید در پیوی ربات', url: buyUrl(username, item.key) }]],
    };
    const priceLine = item.priceInfo.percent > 0
      ? `🔥 ${item.priceInfo.percent}% تخفیف — ${item.priceInfo.final} سکه`
      : `🪙 ${item.priceInfo.final} سکه`;
    const title = `${item.emoji || ''} ${item.label}`.trim();
    const fileId = await imageService.getFileId(slots.itemSlot(item.key)).catch(() => null);
    const hasPicture = !!(fileId || (await imageService.has(slots.itemSlot(item.key)).catch(() => false)));

    // Photo-type inline results show ONLY the picture in Telegram's list (no title / price text),
    // so when the server has a public URL every product is an "article" row: the title, price and
    // description stay visible in the list, the picture is the row's thumbnail, and the sent message
    // still shows the picture above the text through a link preview.
    if (env.WEBAPP_URL && hasPicture) {
      const sig = await imageService.getSignature(slots.itemSlot(item.key)).catch(() => 'x');
      const base = `${env.WEBAPP_URL}/img/item/${encodeURIComponent(item.key)}.jpg?v=${encodeURIComponent(sig)}`;
      const img = `${base}&s=800`;
      const thumb = `${base}&s=160`;
      results.push({
        type: 'article',
        id: `shop_${item.key}`.slice(0, 64),
        title,
        description: `${priceLine}\n${item.description || ''}`.trim().slice(0, 200),
        thumbnail_url: thumb,
        input_message_content: {
          message_text: caption,
          parse_mode: 'HTML',
          link_preview_options: { url: img, show_above_text: true, prefer_large_media: true },
        },
        reply_markup: markup,
      });
    } else if (fileId) {
      results.push({
        type: 'photo',
        id: `shop_${item.key}`.slice(0, 64),
        photo_file_id: fileId,
        title,
        description: priceLine,
        caption,
        parse_mode: 'HTML',
        reply_markup: markup,
      });
    } else {
      results.push({
        type: 'article',
        id: `shop_${item.key}`.slice(0, 64),
        title,
        description: `${priceLine}\n${item.description || ''}`.trim(),
        input_message_content: { message_text: caption, parse_mode: 'HTML' },
        reply_markup: markup,
      });
    }
  }

  try {
    await ctx.answerInlineQuery(results, { cache_time: 20, is_personal: false, next_offset: nextOffset });
  } catch (err) {
    // One bad result makes Telegram reject the whole answer and the shop shows nothing. Retry with
    // plain text rows (no thumbnails / photos / link previews) so the shop always opens.
    console.error('[inline-shop] answerInlineQuery failed, retrying with plain results:', err.message);
    const plain = catalog.map((item) => ({
      type: 'article',
      id: `shop_${item.key}`.slice(0, 64),
      title: `${item.emoji || ''} ${item.label}`.trim(),
      description: (item.priceInfo.percent > 0 ? `🔥 ${item.priceInfo.final} سکه (${item.priceInfo.percent}% تخفیف)` : `🪙 ${item.priceInfo.final} سکه`),
      input_message_content: { message_text: productCaption(item, item.priceInfo), parse_mode: 'HTML' },
      reply_markup: { inline_keyboard: [[{ text: '🛒 خرید در پیوی ربات', url: buyUrl(username, item.key) }]] },
    }));
    await ctx.answerInlineQuery(plain, { cache_time: 5, is_personal: false, next_offset: nextOffset }).catch((err2) => {
      console.error('[inline-shop] plain answer failed too:', err2.message);
    });
  }
}

function register(bot) {
  bot.on('inline_query', async (ctx) => {
    try {
      await onInlineQuery(ctx);
    } catch (err) {
      console.error('[inline-shop] handler failed:', err);
      await ctx.answerInlineQuery([], { cache_time: 1 }).catch(() => {});
    }
  });
}

module.exports = { register, parseQuery };
