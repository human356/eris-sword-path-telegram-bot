'use strict';
const inventoryModel = require('../../database/models/inventoryModel');
const cardLoadoutModel = require('../../database/models/cardLoadoutModel');
const shopService = require('../../economy/shopService');
const { num, escapeHtml } = require('../../utils/format');

// Labels for the 5 starter moves. Phase 2 will extend this with purchasable
// special cards once those exist in items.json.
const CARD_LABELS = {
  ATTACK: '⚔️ حمله ساده',
  GUARD: '🛡 دفاع ساده',
  DODGE: '💨 جاخالی',
  HEAVY_ATTACK: '🔥 حمله سنگین',
  COUNTER: '⚡ ضدحمله',
};

async function buildInventoryText(telegramId, groupId, displayName) {
  const items = await inventoryModel.getInventory(telegramId, groupId);
  const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);

  let text = `🎒 <b>جیب من</b>\n👤 ${escapeHtml(displayName)}\n\n`;

  text += `<b>کارت‌های نبرد فعال (۵ خانه):</b>\n`;
  loadout.forEach((cardKey, i) => {
    text += `${i + 1}. ${CARD_LABELS[cardKey] || cardKey}\n`;
  });
  text += `<i>تعویض کارت‌ها به‌زودی از همین‌جا فعال می‌شود — فعلاً فقط نمایشی است.</i>\n\n`;

  text += `<b>آیتم‌ها:</b>\n`;
  if (items.length === 0) {
    text += `چیزی در جیب شما نیست. از /shop خرید کنید!`;
  } else {
    for (const row of items) {
      const def = shopService.getItemDef(row.item_key);
      text += `${def ? def.emoji : '📦'} ${def ? def.label : row.item_key}: ${num(row.quantity)} عدد\n`;
    }
  }

  text += `\n<i>🔒 این بخش کاملاً خصوصی است — فقط شما آن را می‌بینید.</i>`;
  return text;
}

async function showInventory(ctx) {
  const { user, groupId } = ctx.state;
  const text = await buildInventoryText(user.telegramId, groupId, user.displayName);
  const isCallback = ctx.updateType === 'callback_query';

  try {
    await ctx.telegram.sendMessage(user.telegramId, text, { parse_mode: 'HTML' });
    if (isCallback) {
      await ctx.answerCbQuery('📩 جیب شما به پیوی ارسال شد.');
    } else {
      await ctx.reply('📩 جیب شما به پیوی ارسال شد تا کسی جز خودتان آن را نبیند.');
    }
  } catch {
    const notice =
      '⚠️ برای مشاهدهٔ «جیب من» باید اول ربات را در پیوی استارت کنید ' +
      '(روی نام ربات بزنید و /start را بفرستید)، سپس دوباره اینجا امتحان کنید.';
    if (isCallback) {
      await ctx.answerCbQuery(notice, { show_alert: true });
    } else {
      await ctx.reply(notice);
    }
  }
}

function register(bot) {
  bot.command(['inventory', 'jibeman'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    await showInventory(ctx);
  });

  bot.action('menu:inventory', async (ctx) => {
    await showInventory(ctx);
  });
}

module.exports = { register };
