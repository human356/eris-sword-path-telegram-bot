'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const trainingService = require('../../training/trainingService');
const { trainingKeyboard, mainMenu } = require('../keyboards');
const erisVoice = require('../../eris/erisVoice');
const rageService = require('../../eris/rageService');
const erisEventService = require('../../events/erisEventService');
const C = require('../../config/constants');

const STAT_LABELS = {
  attack: 'Attack', speed: 'Speed', defense: 'Defense', crit_chance: 'Critical Chance',
};

async function showMenu(ctx) {
  const { user, groupId } = ctx.state;
  const remaining = await trainingService.getTrainingCooldownRemaining(user.telegramId, groupId);
  if (remaining > 0) {
    return ctx.reply(`🏋️ You're still recovering from training. Try again in ${Math.ceil(remaining / 60)}m.`);
  }
  await ctx.reply('🏋️ <b>ERIS TRAINING</b>\n\nChoose Training:', { parse_mode: 'HTML', ...trainingKeyboard() });
}

function register(bot) {
  bot.command('train', showMenu);
  bot.action('menu:training', async (ctx) => { await ctx.answerCbQuery(); await showMenu(ctx); });

  bot.action(/^training:(STRENGTH|SPEED|DEFENSE|ACCURACY)$/, async (ctx) => {
    const trainingKey = ctx.match[1];
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;

    const result = await trainingService.train(user.telegramId, groupId, stats, trainingKey);
    if (!result.success) {
      const messages = {
        COOLDOWN: `⏱ Recovering. Try again in ${Math.ceil((result.remaining || 0) / 60)}m.`,
        NO_STAMINA: '⚡ Not enough stamina to train right now.',
        INVALID_TYPE: 'Unknown training type.',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'Could not train right now.', { show_alert: true });
    }
    await ctx.answerCbQuery('Training complete!');

    const rageResult = await rageService.addRage(groupId, C.RAGE_PER_TRAINING);
    if (rageResult.triggeredEvent) {
      await erisEventService.announceEvent(ctx.telegram, rageResult.triggeredEvent, ctx.chat.id);
    } // ctx.telegram exposes .sendMessage directly, matching announceEvent's expectation

    let text = `🏋️ <b>TRAINING COMPLETE</b>\n\n⭐ +${C.TRAINING_XP_REWARD} XP`;
    if (result.statGained) {
      text += `\n📈 +1 ${STAT_LABELS[result.statGained] || result.statGained}`;
    }
    if (result.xpResult.leveledUp) {
      text += `\n\n🎉 Level up! You are now Level ${result.xpResult.stats.level}.`;
    }
    text += `\n\nEris: "${erisVoice.say('training_done')}"`;

    await ctx.reply(text, { parse_mode: 'HTML', ...mainMenu() });
  });
}

module.exports = { register };
