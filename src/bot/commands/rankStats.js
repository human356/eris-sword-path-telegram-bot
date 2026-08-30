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

    let text = `⚔️ <b>SWORD RANK</b>\n\n👤 ${escapeHtml(user.displayName)}\n🏆 Current Rank: ${rank.label}\n\n`;
    if (next) {
      text +=
        `Next Rank: ${next.label}\n` +
        `Requirements:\n` +
        `⭐ Level ≥ ${next.minLevel} (you: ${stats.level})\n` +
        `🏆 Rating ≥ ${num(next.minRating)} (you: ${num(stats.rating)})\n` +
        `⚔️ Duels ≥ ${next.minDuels} (you: ${stats.wins + stats.losses + stats.draws})\n` +
        `📊 Win Rate ≥ ${Math.round(next.minWinRate * 100)}% (you: ${Math.round(winRate(stats.wins, stats.losses) * 100)}%)` +
        (next.requiresErisChallengeWin ? `\n🔥 Requires a successful Eris Challenge` : '');
    } else {
      text += `You have reached the highest Sword Rank. 👑`;
    }
    await ctx.reply(text, { parse_mode: 'HTML' });
  });

  bot.command('stats', async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const text =
      `📊 <b>STATS</b>\n\n👤 ${escapeHtml(user.displayName)}\n\n` +
      `⚔️ Total Fights: ${num(stats.total_fights)}\n` +
      `🏋️ Total Training: ${num(stats.total_training)}\n` +
      `🔥 Best Streak: ${stats.best_streak}\n` +
      `📈 Win Rate: ${Math.round(winRate(stats.wins, stats.losses) * 100)}%\n` +
      `📅 Joined: ${new Date(stats.join_date).toISOString().slice(0, 10)}`;
    await ctx.reply(text, { parse_mode: 'HTML' });
  });
}

module.exports = { register };
