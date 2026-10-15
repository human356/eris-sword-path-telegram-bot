'use strict';
const { Markup } = require('telegraf');
const playerStatsModel = require('../../database/models/playerStatsModel');
const dailyModel = require('../../database/models/dailyChallengeModel');
const xpService = require('../../ranking/xpService');
const coinService = require('../../economy/coinService');
const rageService = require('../../eris/rageService');
const erisEventService = require('../../events/erisEventService');
const erisVoice = require('../../eris/erisVoice');
const { CHALLENGE_DEFS, pickRandomChallenge } = require('../../services/dailyChallengeService');
const C = require('../../config/constants');

async function showDaily(ctx) {
  const { user, groupId } = ctx.state;
  const challenge = await dailyModel.getOrCreateTodayChallenge(
    user.telegramId,
    groupId,
    pickRandomChallenge
  );
  const def = CHALLENGE_DEFS[challenge.challenge_key];

  let text = `⚔️ <b>چالش روزانه</b>\n\n"${def.label}"\n\nپیشرفت: ${challenge.progress} / ${challenge.target}\n\n`;
  text += `پاداش:\n+${def.xp} XP\n+${def.coins} سکه\n+${def.respect} احترام اریس`;

  if (challenge.completed && !challenge.claimed) {
    text += `\n\n✅ تکمیل شد! پاداش خود را از پایین دریافت کنید.`;
  } else if (challenge.claimed) {
    text += `\n\n🎁 پاداش قبلاً دریافت شده است. فردا دوباره برگردید!`;
  } else {
    text += `\n\nEris: "${erisVoice.say('daily_ready')}"`;
  }

  const keyboard = challenge.completed && !challenge.claimed
    ? Markup.inlineKeyboard([
        [Markup.button.callback('🎁 دریافت پاداش', `daily:${challenge.id}:claim`)]
      ])
    : undefined;

  await ctx.reply(text, { parse_mode: 'HTML', ...(keyboard || {}) });
}

function register(bot) {
  bot.command('daily', async (ctx) => {
    if (ctx.state.isGroup) await showDaily(ctx);
  });

  bot.action('menu:daily', async (ctx) => {
    await ctx.answerCbQuery();
    await showDaily(ctx);
  });

  bot.action(/^daily:(\d+):claim$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    const { user, groupId } = ctx.state;

    const claimed = await dailyModel.markClaimed(id);

    if (!claimed) {
      return ctx.answerCbQuery(
        'پاداشی برای دریافت وجود ندارد.',
        { show_alert: true }
      );
    }

    if (claimed.telegram_id !== user.telegramId) {
      return ctx.answerCbQuery(
        'این چالش متعلق به شما نیست.',
        { show_alert: true }
      );
    }

    const def = CHALLENGE_DEFS[claimed.challenge_key];

    const stats = (
      await playerStatsModel.getOrCreatePlayerStats(
        user.telegramId,
        groupId
      )
    ).stats;

    const xpResult = await xpService.grantXp(
      user.telegramId,
      groupId,
      stats,
      def.xp
    );

    const updated = await coinService.grantCoins(
      user.telegramId,
      groupId,
      xpResult.stats,
      def.coins,
      'DAILY'
    );

    await playerStatsModel.updatePlayerStats(
      user.telegramId,
      groupId,
      {
        eris_respect: updated.eris_respect + def.respect,
      }
    );

    await rageService
      .addRage(groupId, C.RAGE_PER_DAILY)
      .then(async (rageResult) => {
        if (rageResult.triggeredEvent) {
          await erisEventService.announceEvent(
            ctx.telegram,
            rageResult.triggeredEvent,
            ctx.chat.id, ctx.state.threadId || 0
          );
        }
      });

    await ctx.answerCbQuery('پاداش دریافت شد!');

    await ctx.reply(
      `🎁 دریافت شد: +${def.xp} XP، +${def.coins} سکه، +${def.respect} احترام اریس!`
    );
  });
}

module.exports = { register };