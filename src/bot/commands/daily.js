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
  const challenge = await dailyModel.getOrCreateTodayChallenge(user.telegramId, groupId, pickRandomChallenge);
  const def = CHALLENGE_DEFS[challenge.challenge_key];

  let text = `⚔️ <b>DAILY CHALLENGE</b>\n\n"${def.label}"\n\nProgress: ${challenge.progress} / ${challenge.target}\n\n`;
  text += `Reward:\n+${def.xp} XP\n+${def.coins} Coins\n+${def.respect} Eris Respect`;

  if (challenge.completed && !challenge.claimed) {
    text += `\n\n✅ Completed! Claim your reward below.`;
  } else if (challenge.claimed) {
    text += `\n\n🎁 Reward already claimed. Come back tomorrow!`;
  } else {
    text += `\n\nEris: "${erisVoice.say('daily_ready')}"`;
  }

  const keyboard = challenge.completed && !challenge.claimed
    ? Markup.inlineKeyboard([[Markup.button.callback('🎁 Claim Reward', `daily:${challenge.id}:claim`)]])
    : undefined;

  await ctx.reply(text, { parse_mode: 'HTML', ...(keyboard || {}) });
}

function register(bot) {
  bot.command('daily', async (ctx) => { if (ctx.state.isGroup) await showDaily(ctx); });
  bot.action('menu:daily', async (ctx) => { await ctx.answerCbQuery(); await showDaily(ctx); });

  bot.action(/^daily:(\d+):claim$/, async (ctx) => {
    const id = Number(ctx.match[1]);
    const { user, groupId } = ctx.state;
    const claimed = await dailyModel.markClaimed(id);
    if (!claimed) return ctx.answerCbQuery('Nothing to claim.', { show_alert: true });
    if (claimed.telegram_id !== user.telegramId) return ctx.answerCbQuery('This is not your challenge.', { show_alert: true });

    const def = CHALLENGE_DEFS[claimed.challenge_key];
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const xpResult = await xpService.grantXp(user.telegramId, groupId, stats, def.xp);
    const updated = await coinService.grantCoins(user.telegramId, groupId, xpResult.stats, def.coins, 'DAILY');
    await playerStatsModel.updatePlayerStats(user.telegramId, groupId, {
      eris_respect: updated.eris_respect + def.respect,
    });
    await rageService.addRage(groupId, C.RAGE_PER_DAILY).then(async (rageResult) => {
      if (rageResult.triggeredEvent) {
        await erisEventService.announceEvent(ctx.telegram, rageResult.triggeredEvent, ctx.chat.id);
      }
    });

    await ctx.answerCbQuery('Reward claimed!');
    await ctx.reply(`🎁 Claimed: +${def.xp} XP, +${def.coins} Coins, +${def.respect} Eris Respect!`);
  });
}

module.exports = { register };
