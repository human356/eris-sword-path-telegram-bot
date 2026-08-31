'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const { getRankByKey } = require('../../utils/rankUtil');
const { num, escapeHtml } = require('../../utils/format');
const { winRate } = require('../../utils/formulas');
const C = require('../../config/constants');

function register(bot) {
  bot.command('rank', async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const rank = getRankByKey(stats.sword_rank);
    const currentIdx = C.SWORD_RANKS.findIndex((r) => r.key === stats.sword_rank);
    const next = currentIdx > 0 ? C.SWORD_RANKS[currentIdx - 1] : null;

    let text = `⚔️ <b>رتبهٔ شمشیر</b>\n\n👤 ${escapeHtml(user.displayName)}\n🏆 رتبهٔ فعلی: ${rank.label}\n\n`;

if (next) {
  text +=
    `رتبهٔ بعدی: ${next.label}\n` +
    `شرایط ارتقا:\n` +
    `⭐ سطح ≥ ${next.minLevel} (سطح شما: ${stats.level})\n` +
    `🏆 امتیاز ≥ ${num(next.minRating)} (امتیاز شما: ${num(stats.rating)})\n` +
    `⚔️ دوئل‌ها ≥ ${next.minDuels} (دوئل‌های شما: ${stats.wins + stats.losses + stats.draws})\n` +
    `📊 نرخ پیروزی ≥ ${Math.round(next.minWinRate * 100)}٪ (نرخ شما: ${Math.round(winRate(stats.wins, stats.losses) * 100)}٪)` +
    (next.requiresErisChallengeWin
      ? `\n🔥 نیازمند یک پیروزی در چالش اریس`
      : '');
} else {
  text += `شما به بالاترین رتبهٔ شمشیر رسیده‌اید. 👑`;
}

await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('stats', async (ctx) => {
  if (!ctx.state.isGroup) return;

  const { user, groupId } = ctx.state;

  const stats = (
    await playerStatsModel.getOrCreatePlayerStats(
      user.telegramId,
      groupId
    )
  ).stats;

  const text =
    `📊 <b>آمار</b>\n\n👤 ${escapeHtml(user.displayName)}\n\n` +
    `⚔️ تعداد کل مبارزات: ${num(stats.total_fights)}\n` +
    `🏋️ تعداد کل تمرین‌ها: ${num(stats.total_training)}\n` +
    `🔥 بهترین رکورد پیروزی متوالی: ${stats.best_streak}\n` +
    `📈 نرخ پیروزی: ${Math.round(winRate(stats.wins, stats.losses) * 100)}٪\n` +
    `📅 تاریخ عضویت: ${new Date(stats.join_date).toISOString().slice(0, 10)}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
});
}
module.exports = { register };
