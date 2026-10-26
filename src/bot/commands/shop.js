'use strict';
const shopService = require('../../economy/shopService');
const { Markup } = require('telegraf');
const { num, escapeHtml } = require('../../utils/format');

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
