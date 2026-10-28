'use strict';
const shopService = require('../../economy/shopService');
const { Markup } = require('telegraf');
const { num, escapeHtml } = require('../../utils/format');
const imageService = require('../../services/imageService');
const slots = require('../../config/imageSlots');
const { productCaption, botUsernameOf, buyUrl } = require('../../utils/shopText');

/**
 * In-chat paged shop: one product per page (photo + text) with ◀ قبلی / بعدی ▶ buttons, so every
 * item of the list is reachable. Pages wrap around.
 */
function pageKeyboard(item, index, total, username, groupId) {
  const prev = (index - 1 + total) % total;
  const next = (index + 1) % total;
  const rows = [
    [
      Markup.button.callback('◀️ قبلی', `shop:page:${prev}`),
      Markup.button.callback(`${index + 1} / ${total}`, 'shop:noop'),
      Markup.button.callback('بعدی ▶️', `shop:page:${next}`),
    ],
    [Markup.button.callback(`🛒 خرید با ${num(item.priceInfo.final)} سکه`, `shop:buy:${item.key}`)],
  ];
  if (username) rows.push([Markup.button.url('🔗 خرید در پیوی ربات', buyUrl(username, item.key, groupId))]);
  return Markup.inlineKeyboard(rows);
}

async function showPage(ctx, requested) {
  const catalog = await shopService.listShopCatalog();
  if (catalog.length === 0) return ctx.reply('فروشگاه فعلاً خالی است.');
  const total = catalog.length;
  const index = ((Number(requested) || 0) % total + total) % total;
  const item = catalog[index];
  const username = await botUsernameOf(ctx.telegram, ctx.botInfo);
  const caption = productCaption(item, item.priceInfo);
  const keyboard = pageKeyboard(item, index, total, username, ctx.state.groupId);
  const photo = await imageService.photoFor(slots.itemSlot(item.key)).catch(() => null);
  const current = ctx.callbackQuery && ctx.callbackQuery.message;

  // Same media type as the message on screen -> edit in place (fast, no flicker).
  if (current) {
    const isPhoto = !!current.photo;
    try {
      if (photo && isPhoto && typeof photo.input === 'string') {
        await ctx.editMessageMedia({ type: 'photo', media: photo.input, caption, parse_mode: 'HTML' }, keyboard);
        return undefined;
      }
      if (!photo && !isPhoto) {
        await ctx.editMessageText(caption, { parse_mode: 'HTML', ...keyboard });
        return undefined;
      }
    } catch (err) {
      if (/not modified/i.test(String(err.message))) return undefined;
    }
    await ctx.deleteMessage().catch(() => {});
  }

  if (photo) {
    try {
      const msg = await ctx.replyWithPhoto(photo.input, { caption, parse_mode: 'HTML', ...keyboard });
      await photo.remember(msg).catch(() => {});
      return msg;
    } catch (err) {
      console.error('[shop] photo page failed, sending text:', item.key, err.message);
    }
  }
  return ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
}

/**
 * The shop now lives in the group's text box: «@botusername shop» lists the products
 * (see inlineShop.js). /shop and the 🛒 menu button just explain that and offer a
 * one-tap button that types it for the player, plus this week's discounts.
 */
async function showShop(ctx) {
  const catalog = await shopService.listShopCatalog();
  const offers = catalog.filter((i) => i.priceInfo.percent > 0);

  let text = `🛒 <b>فروشگاه اریس</b>\n\n` +
    `فروشگاه حالا داخل خود گروه است: در متن‌باکس گروه بنویسید <code>@${(ctx.botInfo && ctx.botInfo.username) || 'bot'} shop</code> ` +
    `و محصولات را با عکس ببینید؛ با انتخاب هر محصول، دکمهٔ خرید مستقیم در پیوی ربات برایتان ارسال می‌شود.\n`;

  if (offers.length > 0) {
    text += `\n🔥 <b>تخفیف‌های این هفته</b>\n`;
    for (const item of offers) {
      text += `${item.emoji || '📦'} ${escapeHtml(item.label)} — <s>${num(item.priceInfo.base)}</s> <b>${num(item.priceInfo.final)}</b> 🪙 (${item.priceInfo.percent}%)\n`;
    }
  }

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📖 مرور محصولات (قبلی / بعدی)', 'shop:page:0')],
      [Markup.button.switchToCurrentChat('🛒 باز کردن فروشگاه', 'shop')],
      [Markup.button.callback('🎒 جیب من', 'menu:inventory')],
    ]),
  });
}

function register(bot) {
  bot.command('shop', async (ctx) => {
    if (!ctx.state.isGroup) return;
    await showShop(ctx);
  });

  bot.action(/^shop:page:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    if (!ctx.state.isGroup) return undefined;
    return showPage(ctx, Number(ctx.match[1]));
  });
  bot.action('shop:noop', (ctx) => ctx.answerCbQuery().catch(() => {}));

  bot.action('menu:shop', async (ctx) => {
    await ctx.answerCbQuery();
    await showShop(ctx);
  });

  bot.action(/^shop:buy:([A-Z_]+)$/, async (ctx) => {
    const itemKey = ctx.match[1];
    const { user, groupId } = ctx.state;

    // FIX: `result` must be declared (let), otherwise — because this file is
    // 'use strict' — assigning to it inside the try block throws a
    // ReferenceError *after* shopService.buyItem() has already fully run
    // (coins already spent, item already granted, purchase already logged).
    // That ReferenceError was being swallowed by the catch below, which then
    // told the user "your coins were NOT touched, try again" — a false
    // message, since the purchase had in fact already gone through. This is
    // exactly the "coins get deducted but nothing is granted (as far as the
    // user can tell)" bug being reported.
    let result;
    try {
      result = await shopService.buyItem(user.telegramId, groupId, itemKey, 1);
    } catch (err) {
      console.error('[shop] buyItem failed:', err);
      return ctx.answerCbQuery('⚠️ خطایی در خرید رخ داد. سکه‌های شما مسدود نشده، دوباره تلاش کنید یا با ادمین تماس بگیرید.', { show_alert: true });
    }

    if (!result.success) {
      const messages = {
        INVALID_ITEM: 'این آیتم در دسترس نیست.',
        NOT_ENOUGH_COINS: `سکه کافی ندارید. قیمت: ${result.price ? num(result.price) : ''}`,
        DAILY_LIMIT: 'سقف خرید روزانهٔ این آیتم پر شده است. فردا دوباره سر بزنید.',
        ALREADY_OWNED: 'شما این مورد را از قبل دارید.',
        NOT_IN_ROTATION: 'این آیتم تزئینی دیگر در چرخش این هفته نیست. فروشگاه را دوباره باز کنید.',
      };
      return ctx.answerCbQuery(
        messages[result.reason] || 'خرید انجام نشد.',
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery(
      `✅ ${result.item.emoji || ''} ${result.item.label} خریداری شد!\nموجودی جدید: ${result.newInventoryQty}\nسکهٔ باقی‌مانده: ${result.remainingCoins}`,
      { show_alert: true }
    );
  });
}

module.exports = { register };
