'use strict';
const { Markup } = require('telegraf');
const itemsCatalog = require('../../config/items.json');
const inventoryModel = require('../../database/models/inventoryModel');
const showcaseModel = require('../../database/models/showcaseModel');
const playerStatsModel = require('../../database/models/playerStatsModel');
const profilePrefsModel = require('../../database/models/profilePrefsModel');
const profileCardService = require('../../services/profileCardService');
const slots = require('../../config/imageSlots');
const { isTitleKey } = require('../../utils/itemText');
const { escapeHtml } = require('../../utils/format');

/**
 * «پروفایل من» — profile management, reached from «جیب من» (private chat).
 *   - preview of the image card
 *   - choose the card template (free default + the paid ones the player owns)
 *   - choose which owned title is shown under the name
 *   - showcase editor (lives in inventory.js, linked from here)
 *   - publish the card to the group
 * Any change that alters the card posts the NEW card picture into the group
 * (rate-limited so toggling buttons can't flood the group).
 */
const PUBLISH_COOLDOWN_MS = 30 * 1000;
const lastPublish = new Map(); // `${tid}:${gid}` -> ts

const labelOf = (key) => {
  const def = itemsCatalog[key];
  return def ? `${def.emoji || ''} ${def.label}`.trim() : key;
};

async function loadState(telegramId, groupId) {
  const [stats, prefs, inv, showcase] = await Promise.all([
    playerStatsModel.getPlayerStats(telegramId, groupId),
    profilePrefsModel.getPrefs(telegramId, groupId),
    inventoryModel.getInventory(telegramId, groupId),
    showcaseModel.getShowcase(telegramId, groupId),
  ]);
  const owned = new Set(inv.filter((r) => r.quantity > 0).map((r) => r.item_key));
  const ownedTemplates = slots.profileTemplateKeys().filter((k) => owned.has(k));
  const ownedTitles = Object.keys(itemsCatalog).filter((k) => isTitleKey(k) && owned.has(k));
  const template = prefs.template_key && owned.has(prefs.template_key) ? prefs.template_key : null;
  const title = prefs.title_key && owned.has(prefs.title_key) ? prefs.title_key : null;
  return { stats, owned, ownedTemplates, ownedTitles, template, title, showcase };
}

async function publishIfAllowed(ctx, groupId, caption) {
  const key = `${ctx.from.id}:${groupId}`;
  if (Date.now() - (lastPublish.get(key) || 0) < PUBLISH_COOLDOWN_MS) return false;
  lastPublish.set(key, Date.now());
  try {
    await profileCardService.postUpdatedCard(ctx.telegram, { telegramId: ctx.from.id, groupId, caption });
    return true;
  } catch (err) {
    if (err.message !== 'PROFILE_CARD_UNAVAILABLE') console.error('[profile-manage] publish failed:', err.message);
    return false;
  }
}

async function renderHome(ctx, groupId, { edit = true } = {}) {
  const st = await loadState(ctx.from.id, groupId);
  if (!st.stats) {
    const msg = 'هنوز در این گروه پروفایلی ندارید. اول داخل گروه /profile بزنید.';
    return edit ? ctx.editMessageText(msg).catch(() => ctx.reply(msg)) : ctx.reply(msg);
  }

  const showcaseLine = st.showcase.map((k) => (k ? labelOf(k) : '— خالی —')).join('\n   ');
  const text =
    `🖼 <b>پروفایل من</b>\n\n` +
    `🎨 قالب: ${st.template ? escapeHtml(labelOf(st.template)) : 'رایگان (پیش‌فرض)'}\n` +
    `🏷 عنوان: ${st.title ? escapeHtml(labelOf(st.title)) : 'بدون عنوان'}\n` +
    `🗂 ویترین:\n   ${escapeHtml(showcaseLine)}\n\n` +
    `قالب‌ها: ${st.ownedTemplates.length} مورد خریداری‌شده  |  عنوان‌ها: ${st.ownedTitles.length} مورد\n\n` +
    `<i>هر تغییری بدهید، تصویر جدید پروفایل در گروه هم ارسال می‌شود. قالب‌ها و عنوان‌های جدید را از فروشگاه (<code>@bot shop</code>) بخرید.</i>`;

  const rows = [
    [Markup.button.callback('🎨 تغییر قالب', `jib:tpl:${groupId}`), Markup.button.callback('🏷 انتخاب عنوان', `jib:ttl:${groupId}`)],
    [Markup.button.callback('🗂 ویرایش ویترین', `jib:showcase:${groupId}`)],
    [Markup.button.callback('👁 پیش‌نمایش', `jib:pv:${groupId}`), Markup.button.callback('📢 ارسال در گروه', `jib:pub:${groupId}`)],
    [Markup.button.callback('🔙 جیب من', `jib:home:${groupId}`)],
  ];
  const extra = { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) };
  if (edit) return ctx.editMessageText(text, extra).catch(() => ctx.reply(text, extra));
  return ctx.reply(text, extra);
}

function register(bot) {
  bot.action(/^jib:prof:(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await renderHome(ctx, Number(ctx.match[1]));
  });

  bot.action(/^jib:tpl:(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const groupId = Number(ctx.match[1]);
    const st = await loadState(ctx.from.id, groupId);
    const rows = [[Markup.button.callback(`${st.template ? '' : '✅ '}🆓 قالب رایگان`, `jib:tplset:${groupId}:NONE`)]];
    for (const key of st.ownedTemplates) {
      rows.push([Markup.button.callback(`${st.template === key ? '✅ ' : ''}${labelOf(key)}`, `jib:tplset:${groupId}:${key}`)]);
    }
    rows.push([Markup.button.callback('🔙 بازگشت', `jib:prof:${groupId}`)]);
    const text = st.ownedTemplates.length === 0
      ? '🎨 هنوز قالب پولی‌ای نخریده‌اید. از فروشگاه (<code>@bot shop</code>) قالب‌های جدید را ببینید.\n\nقالب فعلی: رایگان'
      : '🎨 <b>قالب کارت پروفایل</b> را انتخاب کنید:';
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) }).catch(() => {});
  });

  bot.action(/^jib:tplset:(-?\d+):([A-Z][A-Z0-9_]*)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const key = ctx.match[2];
    if (key !== 'NONE') {
      const owned = await inventoryModel.getItemQuantity(ctx.from.id, groupId, key);
      const def = itemsCatalog[key];
      if (owned <= 0 || !def || def.category !== 'PROFILE_TEMPLATE') {
        return ctx.answerCbQuery('این قالب را ندارید.', { show_alert: true });
      }
    }
    await profilePrefsModel.setTemplate(ctx.from.id, groupId, key === 'NONE' ? null : key);
    await ctx.answerCbQuery('✅ قالب تغییر کرد');
    await publishIfAllowed(ctx, groupId, '🎨 قالب پروفایل عوض شد!');
    await renderHome(ctx, groupId);
  });

  bot.action(/^jib:ttl:(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const groupId = Number(ctx.match[1]);
    const st = await loadState(ctx.from.id, groupId);
    const rows = [[Markup.button.callback(`${st.title ? '' : '✅ '}بدون عنوان`, `jib:ttlset:${groupId}:NONE`)]];
    for (const key of st.ownedTitles) {
      rows.push([Markup.button.callback(`${st.title === key ? '✅ ' : ''}${labelOf(key)}`, `jib:ttlset:${groupId}:${key}`)]);
    }
    rows.push([Markup.button.callback('🔙 بازگشت', `jib:prof:${groupId}`)]);
    const text = st.ownedTitles.length === 0
      ? '🏷 هنوز عنوانی نخریده‌اید. عنوان‌ها در «🎨 تزئینات این هفته» فروشگاه می‌آیند.'
      : '🏷 عنوانی که زیر نامتان در کارت دیده می‌شود را انتخاب کنید:';
    await ctx.editMessageText(text, Markup.inlineKeyboard(rows)).catch(() => {});
  });

  bot.action(/^jib:ttlset:(-?\d+):([A-Z][A-Z0-9_]*)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const key = ctx.match[2];
    if (key !== 'NONE') {
      const owned = await inventoryModel.getItemQuantity(ctx.from.id, groupId, key);
      if (owned <= 0 || !isTitleKey(key)) return ctx.answerCbQuery('این عنوان را ندارید.', { show_alert: true });
    }
    await profilePrefsModel.setTitle(ctx.from.id, groupId, key === 'NONE' ? null : key);
    await ctx.answerCbQuery('✅ عنوان تغییر کرد');
    await publishIfAllowed(ctx, groupId, '🏷 عنوان پروفایل عوض شد!');
    await renderHome(ctx, groupId);
  });

  bot.action(/^jib:pv:(-?\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const user = ctx.state.user;
    await ctx.answerCbQuery('در حال ساخت پیش‌نمایش…');
    try {
      await profileCardService.sendProfileCard(
        ctx.telegram,
        ctx.chat.id,
        { telegramId: user.telegramId, groupId, displayName: user.displayName, username: user.username },
        { extra: { caption: '👁 پیش‌نمایش کارت پروفایل شما' } }
      );
    } catch (err) {
      await ctx.reply(err.message === 'PROFILE_CARD_UNAVAILABLE'
        ? '⚠️ ساخت تصویر پروفایل در حال حاضر در سرور فعال نیست.'
        : '⚠️ ساخت پیش‌نمایش ناموفق بود، کمی بعد دوباره تلاش کنید.');
    }
  });

  bot.action(/^jib:pub:(-?\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const ok = await publishIfAllowed(ctx, groupId, '📢 پروفایل به‌روز شد');
    await ctx.answerCbQuery(ok ? '✅ در گروه ارسال شد' : 'چند لحظه بعد دوباره امتحان کنید.', { show_alert: !ok });
  });
}

module.exports = { register, publishIfAllowed };
