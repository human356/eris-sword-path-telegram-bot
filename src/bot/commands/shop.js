'use strict';
const shopService = require('../../economy/shopService');
const { shopKeyboard } = require('../keyboards');
const { num, escapeHtml } = require('../../utils/format');

function renderShop() {
  const items = shopService.listPurchasableItems();
  let text = `🛒 <b>فروشگاه اریس</b>\n\nبرای خرید هر آیتم روی دکمهٔ آن بزنید.\n\n`;

  for (const item of items) {
    text +=
      `${item.emoji || '📦'} <b>${escapeHtml(item.label)}</b>\n` +
      `${escapeHtml(item.description || '')}\n` +
      `🪙 قیمت: ${num(item.price)}` +
      (item.dailyLimit ? ` | سقف روزانه: ${item.dailyLimit}` : '') +
      `\n\n`;
  }

  return { text: text.trim(), items };
}

async function showShop(ctx) {
  const { text, items } = renderShop();
  await ctx.reply(text, { parse_mode: 'HTML', ...shopKeyboard(items) });
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

    const result = await shopService.buyItem(user.telegramId, groupId, itemKey, 1);

    if (!result.success) {
      const messages = {
        INVALID_ITEM: 'این آیتم در دسترس نیست.',
        NOT_ENOUGH_COINS: `سکه کافی ندارید. قیمت: ${result.price ? num(result.price) : ''}`,
        DAILY_LIMIT: 'سقف خرید روزانهٔ این آیتم پر شده است. فردا دوباره سر بزنید.',
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
