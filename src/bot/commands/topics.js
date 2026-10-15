'use strict';
const { Markup } = require('telegraf');
const { isGroupAdmin } = require('../middlewares/adminGuard');
const topicService = require('../../services/topicService');
const { FEATURES, FEATURE_KEYS } = require('../../config/topicFeatures');
const { getThreadId } = require('../../utils/topic');
const { escapeHtml } = require('../../utils/format');

async function buildPanel(groupId, threadId) {
  const rules = await topicService.loadRules(groupId);
  const names = await topicService.getNames(groupId);

  let text =
    `🧭 <b>تنظیم موضوع‌ها (Topics)</b>\n\n` +
    `📍 موضوع فعلی: <b>${escapeHtml(topicService.labelOf(names, threadId))}</b>\n\n` +
    `به‌صورت پیش‌فرض همهٔ بخش‌ها در همهٔ موضوع‌ها کار می‌کنند. با زدن دکمهٔ هر بخش، ` +
    `<b>همین موضوعی که این پنل را در آن باز کرده‌اید</b> به آن بخش اضافه یا از آن حذف می‌شود. ` +
    `وقتی یک بخش حداقل یک موضوع داشته باشد، فقط در همان موضوع‌ها کار می‌کند.\n\n`;

  const rows = [];
  for (const key of FEATURE_KEYS) {
    const set = rules.get(key);
    const restricted = set && set.size > 0;
    const here = restricted && set.has(threadId);
    const icon = !restricted ? '🌐' : here ? '✅' : '⛔';

    text += restricted
      ? `${FEATURES[key].label}\n   ↳ فقط در: ${Array.from(set).map((id) => escapeHtml(topicService.labelOf(names, id))).join('، ')}\n`
      : `${FEATURES[key].label}\n   ↳ همه‌جا\n`;

    rows.push([Markup.button.callback(`${icon} ${FEATURES[key].label}`, `topicadm:t:${key}`)]);
  }

  text += `\n🌐 همه‌جا  |  ✅ فعال در این موضوع  |  ⛔ فقط در موضوع‌های دیگر`;
  rows.push([Markup.button.callback('♻️ بازنشانی همه (کار در همهٔ موضوع‌ها)', 'topicadm:reset')]);

  return { text, keyboard: Markup.inlineKeyboard(rows) };
}

async function refreshPanel(ctx, groupId, threadId) {
  const { text, keyboard } = await buildPanel(groupId, threadId);
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

function register(bot) {
  bot.command(['topics', 'topic'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await isGroupAdmin(ctx))) {
      return ctx.reply('🚫 این دستور فقط برای ادمین‌های گروه است.');
    }
    const { text, keyboard } = await buildPanel(ctx.state.groupId, getThreadId(ctx));
    await ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  });

  bot.action(/^topicadm:t:([A-Z_]+)$/, async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      return ctx.answerCbQuery('فقط ادمین‌های گروه می‌توانند این را تغییر دهند.', { show_alert: true });
    }
    const feature = ctx.match[1];
    if (!FEATURES[feature]) return ctx.answerCbQuery('بخش نامعتبر است.');

    const groupId = ctx.state.groupId;
    const threadId = getThreadId(ctx);
    await topicService.toggle(groupId, feature, threadId);
    await ctx.answerCbQuery('✅ ذخیره شد');
    await refreshPanel(ctx, groupId, threadId);
  });

  bot.action('topicadm:reset', async (ctx) => {
    if (!(await isGroupAdmin(ctx))) {
      return ctx.answerCbQuery('فقط ادمین‌های گروه می‌توانند این را تغییر دهند.', { show_alert: true });
    }
    const groupId = ctx.state.groupId;
    await topicService.resetAll(groupId);
    await ctx.answerCbQuery('♻️ همه‌چیز در همهٔ موضوع‌ها فعال شد');
    await refreshPanel(ctx, groupId, getThreadId(ctx));
  });
}

module.exports = { register };
