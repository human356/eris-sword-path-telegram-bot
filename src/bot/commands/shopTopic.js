'use strict';
const { Markup } = require('telegraf');
const { isGroupAdmin } = require('../middlewares/adminGuard');
const shopSettingsModel = require('../../database/models/shopSettingsModel');
const shopPostService = require('../../services/shopPostService');
const topicService = require('../../services/topicService');
const { getThreadId } = require('../../utils/topic');
const { escapeHtml } = require('../../utils/format');

/**
 * /shoptopic (group admins): where and whether the bot auto-posts the weekly shop.
 * Open the panel INSIDE the topic that should hold the shop — "📍 this topic" binds it.
 * In a group without topics it just posts into the main chat.
 */
async function panel(groupId, threadId) {
  const s = await shopSettingsModel.getSettings(groupId);
  const names = await topicService.getNames(groupId);
  const target = topicService.labelOf(names, Number(s.thread_id) || 0);
  const text =
    `🛒 <b>تنظیم فروشگاه هفتگی</b>\n\n` +
    `وضعیت: ${s.enabled ? '✅ فعال' : '⏸ غیرفعال'}\n` +
    `موضوع (Topic) فروشگاه: <b>${escapeHtml(target)}</b>\n` +
    `📍 موضوع فعلی که پنل را در آن باز کرده‌اید: <b>${escapeHtml(topicService.labelOf(names, threadId))}</b>\n\n` +
    `ربات هر هفته محصولات و تخفیف‌های جدید را خودکار در همان موضوع می‌فرستد.`;
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback('📍 همین موضوع = موضوع فروشگاه', 'shoptopic:here')],
    [Markup.button.callback(s.enabled ? '⏸ غیرفعال کردن' : '▶️ فعال کردن', 'shoptopic:toggle')],
    [Markup.button.callback('📤 ارسال همین حالا', 'shoptopic:now')],
  ]);
  return { text, kb };
}

async function refresh(ctx) {
  const { text, kb } = await panel(ctx.state.groupId, getThreadId(ctx));
  await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb }).catch(() => {});
}

function register(bot) {
  bot.command(['shoptopic', 'shopsetup'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await isGroupAdmin(ctx))) return ctx.reply('🚫 این دستور فقط برای ادمین‌های گروه است.');
    const { text, kb } = await panel(ctx.state.groupId, getThreadId(ctx));
    await ctx.reply(text, { parse_mode: 'HTML', ...kb });
  });

  const guard = async (ctx) => {
    if (await isGroupAdmin(ctx)) return true;
    await ctx.answerCbQuery('فقط ادمین‌های گروه.', { show_alert: true });
    return false;
  };

  bot.action('shoptopic:here', async (ctx) => {
    if (!(await guard(ctx))) return;
    await shopSettingsModel.setThread(ctx.state.groupId, getThreadId(ctx));
    await shopSettingsModel.setEnabled(ctx.state.groupId, true);
    await ctx.answerCbQuery('✅ ذخیره شد؛ فروشگاه هفتگی فعال است.');
    await refresh(ctx);
  });

  bot.action('shoptopic:toggle', async (ctx) => {
    if (!(await guard(ctx))) return;
    const s = await shopSettingsModel.getSettings(ctx.state.groupId);
    await shopSettingsModel.setEnabled(ctx.state.groupId, !s.enabled);
    await ctx.answerCbQuery(s.enabled ? '⏸ غیرفعال شد' : '▶️ فعال شد');
    await refresh(ctx);
  });

  bot.action('shoptopic:now', async (ctx) => {
    if (!(await guard(ctx))) return;
    const groupId = ctx.state.groupId;
    const s = await shopSettingsModel.getSettings(groupId);
    await ctx.answerCbQuery('در حال ارسال…');
    try {
      await shopPostService.postWeekly(ctx.telegram, groupId, Number(s.thread_id) || 0);
      const { key } = await shopPostService.currentPostKey();
      await shopSettingsModel.markPosted(groupId, key);
    } catch (err) {
      console.error('[shoptopic] manual post failed:', err.message);
      await ctx.reply('⚠️ ارسال فروشگاه ناموفق بود. مطمئن شوید ربات در آن موضوع اجازهٔ ارسال دارد.');
    }
  });
}

module.exports = { register };
