'use strict';
const { Markup } = require('telegraf');
const shopService = require('../../economy/shopService');
const inventoryModel = require('../../database/models/inventoryModel');
const userModel = require('../../database/models/userModel');
const imageService = require('../../services/imageService');
const slots = require('../../config/imageSlots');
const { productCaption } = require('../../utils/shopText');
const { num, escapeHtml } = require('../../utils/format');

/**
 * Direct purchase in the bot's private chat. Entry: /start buy_<ITEM> or
 * /start buy_<groupId>_<ITEM> (links from inline results and weekly shop posts).
 * Coins and inventory are per group, so the player picks which group's wallet to use
 * (skipped when the link already names the group or the player only has one).
 */
const BUY_RE = /^buy_(?:(-?\d+)_)?([A-Z][A-Z0-9_]*)$/;

const FAIL_TEXT = {
  INVALID_ITEM: 'این آیتم در دسترس نیست.',
  NOT_ENOUGH_COINS: 'سکهٔ کافی ندارید.',
  DAILY_LIMIT: 'سقف خرید روزانهٔ این آیتم پر شده است. فردا دوباره سر بزنید.',
  ALREADY_OWNED: 'این مورد را از قبل دارید.',
  NOT_IN_ROTATION: 'این آیتم تزئینی دیگر در چرخش این هفته نیست.',
};

async function sendProduct(ctx, item, info, owned, keyboard) {
  const caption = productCaption(item, info, { owned });
  const photo = await imageService.photoFor(slots.itemSlot(item.key)).catch(() => null);
  if (photo) {
    try {
      const msg = await ctx.replyWithPhoto(photo.input, { caption, parse_mode: 'HTML', ...keyboard });
      await photo.remember(msg);
      return;
    } catch (err) {
      console.error('[private-shop] photo send failed, falling back to text:', err.message);
    }
  }
  await ctx.reply(caption, { parse_mode: 'HTML', ...keyboard });
}

async function showConfirm(ctx, groupId, itemKey, groups) {
  const item = shopService.getItemDef(itemKey);
  if (!item || !item.purchasable) return ctx.reply('⚠️ این محصول در دسترس نیست.');

  const info = await shopService.getPriceInfo(itemKey);
  const owned = (await inventoryModel.getItemQuantity(ctx.from.id, groupId, itemKey)) > 0;
  const group = (groups || []).find((g) => Number(g.group_id) === Number(groupId));

  const rows = [[Markup.button.callback(`✅ خرید با ${num(info.final)} سکه`, `pbuy:ok:${groupId}:${itemKey}`)]];
  rows.push([Markup.button.callback('🔙 انتخاب گروه دیگر', `pbuy:groups:${itemKey}`)]);

  await sendProduct(ctx, { key: itemKey, ...item }, info, owned, Markup.inlineKeyboard(rows));
  if (group && group.group_name) {
    await ctx.reply(`💼 خرید از کیف‌پول شما در گروه «${escapeHtml(group.group_name)}»`, { parse_mode: 'HTML' });
  }
}

async function showGroupPicker(ctx, itemKey, groups, { edit = false } = {}) {
  const rows = groups.slice(0, 20).map((g) => [
    Markup.button.callback(`🏰 ${g.group_name || g.group_id}`, `pbuy:g:${g.group_id}:${itemKey}`),
  ]);
  const text = '🛒 می‌خواهید با سکه‌های کدام گروه خرید کنید؟';
  if (edit) {
    await ctx.editMessageText(text, Markup.inlineKeyboard(rows)).catch(() => ctx.reply(text, Markup.inlineKeyboard(rows)));
  } else {
    await ctx.reply(text, Markup.inlineKeyboard(rows));
  }
}

/** Called from the /start handler. Returns true if the payload was a purchase link. */
async function handleBuyStart(ctx, payload) {
  const m = BUY_RE.exec(payload || '');
  if (!m) return false;
  const itemKey = m[2];
  const item = shopService.getItemDef(itemKey);
  if (!item || !item.purchasable) {
    await ctx.reply('⚠️ این محصول دیگر در فروشگاه نیست.');
    return true;
  }

  const groups = await userModel.listGroupsOfPlayer(ctx.from.id);
  if (groups.length === 0) {
    await ctx.reply('⚔️ هنوز در هیچ گروهی بازی نکرده‌اید. اول داخل گروه /profile بزنید تا پروفایلتان ساخته شود، بعد دوباره از لینک خرید استفاده کنید.');
    return true;
  }

  const linkedGroup = m[1] ? Number(m[1]) : null;
  if (linkedGroup && groups.some((g) => Number(g.group_id) === linkedGroup)) {
    await showConfirm(ctx, linkedGroup, itemKey, groups);
  } else if (groups.length === 1) {
    await showConfirm(ctx, Number(groups[0].group_id), itemKey, groups);
  } else {
    await showGroupPicker(ctx, itemKey, groups);
  }
  return true;
}

function register(bot) {
  bot.action(/^pbuy:g:(-?\d+):([A-Z][A-Z0-9_]*)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const groups = await userModel.listGroupsOfPlayer(ctx.from.id);
    const groupId = Number(ctx.match[1]);
    if (!groups.some((g) => Number(g.group_id) === groupId)) return;
    await showConfirm(ctx, groupId, ctx.match[2], groups);
  });

  bot.action(/^pbuy:groups:([A-Z][A-Z0-9_]*)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const groups = await userModel.listGroupsOfPlayer(ctx.from.id);
    await showGroupPicker(ctx, ctx.match[1], groups);
  });

  bot.action(/^pbuy:ok:(-?\d+):([A-Z][A-Z0-9_]*)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const itemKey = ctx.match[2];

    const groups = await userModel.listGroupsOfPlayer(ctx.from.id);
    if (!groups.some((g) => Number(g.group_id) === groupId)) {
      return ctx.answerCbQuery('شما در این گروه پروفایلی ندارید.', { show_alert: true });
    }

    let result;
    try {
      result = await shopService.buyItem(ctx.from.id, groupId, itemKey, 1);
    } catch (err) {
      console.error('[private-shop] buyItem failed:', err);
      return ctx.answerCbQuery('⚠️ خطایی در خرید رخ داد. سکه‌ها کم نشده‌اند، دوباره تلاش کنید.', { show_alert: true });
    }

    if (!result.success) {
      const extra = result.reason === 'NOT_ENOUGH_COINS' && result.price ? ` قیمت: ${num(result.price)}` : '';
      return ctx.answerCbQuery(`${FAIL_TEXT[result.reason] || 'خرید انجام نشد.'}${extra}`, { show_alert: true });
    }

    await ctx.answerCbQuery(`✅ ${result.item.label} خریداری شد!`, { show_alert: true });

    const rows = [];
    if (['PROFILE_TEMPLATE', 'DECORATIVE'].includes(result.item.category)) {
      rows.push([Markup.button.callback('🖼 مدیریت پروفایل من', `jib:prof:${groupId}`)]);
    }
    await ctx.reply(
      `✅ <b>${escapeHtml(result.item.label)}</b> خریداری شد.\n🪙 پرداختی: ${num(result.paid)}\n💰 سکهٔ باقی‌مانده: ${num(result.remainingCoins)}`,
      { parse_mode: 'HTML', ...(rows.length ? Markup.inlineKeyboard(rows) : {}) }
    );
  });
}

module.exports = { register, handleBuyStart };
