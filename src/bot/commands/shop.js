'use strict';
const shopService = require('../../economy/shopService');
const { shopKeyboard } = require('../keyboards');
const { num, escapeHtml } = require('../../utils/format');

const CATEGORY_LABELS = {
  CONSUMABLE: '🧪 مصرفی‌ها',
  CARD: '🃏 کارت‌های مبارزه',
  MYSTERY: '🎁 اسرارآمیز',
};

function renderItemLine(item) {
  return (
    `${item.emoji || '📦'} <b>${escapeHtml(item.label)}</b>\n` +
    `${escapeHtml(item.description || '')}\n` +
    `🪙 قیمت: ${num(item.price)}` +
    (item.dailyLimit ? ` | سقف روزانه: ${item.dailyLimit}` : '') +
    (item.category === 'CARD' || item.category === 'DECORATIVE' ? ` | یک‌بار قابل خرید` : '') +
    `\n\n`
  );
}

/**
 * Builds the shop text + the flat, category-ordered items array that
 * shopKeyboard() turns into buttons (Phase 6: now split into sections —
 * مصرفی‌ها / کارت‌ها / اسرارآمیز (شامل صندوقچهٔ گنج) / تزئینات این هفته —
 * since the catalog got a lot longer this phase).
 */
async function renderShop() {
  const regularItems = shopService.listPurchasableItems();
  const decorativeItems = await shopService.listDecorativeShopItems();

  const byCategory = { CONSUMABLE: [], CARD: [], MYSTERY: [] };
  for (const item of regularItems) {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  }

  let text = `🛒 <b>فروشگاه اریس</b>\n\nبرای خرید هر آیتم روی دکمهٔ آن بزنید.\n\n`;
  const orderedItems = [];

  for (const cat of ['CONSUMABLE', 'CARD', 'MYSTERY']) {
    const items = byCategory[cat] || [];
    if (items.length === 0) continue;
    text += `<b>${CATEGORY_LABELS[cat] || cat}</b>\n\n`;
    for (const item of items) {
      text += renderItemLine(item);
      orderedItems.push(item);
    }
  }

  if (decorativeItems.length > 0) {
    text +=
      `<b>🎨 تزئینات این هفته</b>\n` +
      `<i>(هر هفته ۵ مورد جدید در چرخش — این‌ها فقط برای نمایش هستند و هیچ اثری روی نبرد ندارند)</i>\n\n`;
    for (const item of decorativeItems) {
      text += renderItemLine(item);
      orderedItems.push(item);
    }
  }

  return { text: text.trim(), items: orderedItems };
}

async function showShop(ctx) {
  const { text, items } = await renderShop();
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
