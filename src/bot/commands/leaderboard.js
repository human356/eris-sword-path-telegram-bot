'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const { getRankByKey } = require('../../utils/rankUtil');
const { num, escapeHtml } = require('../../utils/format');

const MEDALS = ['🥇', '🥈', '🥉'];

function renderBoard(title, rows) {
  let text = `🏆 <b>${title}</b>\n\n`;

  rows.forEach((row, i) => {
    const medal = MEDALS[i] || `${i + 1}️⃣`;
    const rank = getRankByKey(row.sword_rank);

    text += `${medal} ${escapeHtml(row.display_name)}\n⚔️ ${rank ? rank.label : row.sword_rank}\n⭐ ${num(row.rating)} امتیاز\n\n`;
  });

  return text.trim();
}

function register(bot) {
  bot.command('top', async (ctx) => {
    if (!ctx.state.isGroup) return;

    const rows = await playerStatsModel.getGroupLeaderboard(ctx.state.groupId);

    if (rows.length === 0) {
      return ctx.reply(
        'هنوز هیچ مبارزی در این گروه ثبت‌نام نکرده است. از /start استفاده کنید!'
      );
    }

    await ctx.reply(
      renderBoard('رتبه‌بندی شمشیر — گروه', rows),
      { parse_mode: 'HTML' }
    );
  });

  bot.action('menu:ranking', async (ctx) => {
    await ctx.answerCbQuery();

    const rows = await playerStatsModel.getGroupLeaderboard(
      ctx.state.groupId
    );

    if (rows.length === 0) {
      return ctx.reply(
        'هنوز هیچ مبارزی در این گروه ثبت‌نام نکرده است. از /start استفاده کنید!'
      );
    }

    await ctx.reply(
      renderBoard('رتبه‌بندی شمشیر — گروه', rows),
      { parse_mode: 'HTML' }
    );
  });

  bot.command('globaltop', async (ctx) => {
    const rows = await playerStatsModel.getGlobalLeaderboard();

    if (rows.length === 0) {
      return ctx.reply('هنوز هیچ مبارزی ثبت‌نام نکرده است.');
    }

    await ctx.reply(
      renderBoard('رتبه‌بندی جهانی شمشیر', rows),
      { parse_mode: 'HTML' }
    );
  });
}
module.exports = { register };
