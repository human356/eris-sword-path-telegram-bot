'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const trainingService = require('../../training/trainingService');
const { trainingKeyboard, mainMenu } = require('../keyboards');
const erisVoice = require('../../eris/erisVoice');
const rageService = require('../../eris/rageService');
const erisEventService = require('../../events/erisEventService');
const C = require('../../config/constants');

const STAT_LABELS = {
  attack: 'قدرت حمله',
  speed: 'سرعت',
  defense: 'دفاع',
  crit_chance: 'شانس ضربهٔ بحرانی',
};

async function showMenu(ctx) {
  const { user, groupId } = ctx.state;

  const remaining = await trainingService.getTrainingCooldownRemaining(
    user.telegramId,
    groupId
  );

  if (remaining > 0) {
    return ctx.reply(
      `🏋️ هنوز در حال بازیابی پس از تمرین هستید. ${Math.ceil(remaining / 60)} دقیقه دیگر دوباره امتحان کنید.`
    );
  }

  await ctx.reply(
    '🏋️ <b>تمرین اریس</b>\n\nنوع تمرین را انتخاب کنید:',
    { parse_mode: 'HTML', ...trainingKeyboard() }
  );
}

function register(bot) {
  bot.command('train', showMenu);

  bot.action('menu:training', async (ctx) => {
    await ctx.answerCbQuery();
    await showMenu(ctx);
  });

  bot.action(
    /^training:(STRENGTH|SPEED|DEFENSE|ACCURACY)$/,
    async (ctx) => {
      const trainingKey = ctx.match[1];
      const { user, groupId } = ctx.state;

      const stats = (
        await playerStatsModel.getOrCreatePlayerStats(
          user.telegramId,
          groupId
        )
      ).stats;

      const result = await trainingService.train(
        user.telegramId,
        groupId,
        stats,
        trainingKey
      );

      if (!result.success) {
        const messages = {
          COOLDOWN: `⏱ در حال بازیابی هستید. ${Math.ceil((result.remaining || 0) / 60)} دقیقه دیگر دوباره امتحان کنید.`,
          NO_STAMINA: '⚡ استقامت کافی برای تمرین در حال حاضر ندارید.',
          INVALID_TYPE: 'نوع تمرین نامعتبر است.',
        };

        return ctx.answerCbQuery(
          messages[result.reason] || 'در حال حاضر امکان تمرین وجود ندارد.',
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery('تمرین با موفقیت انجام شد!');

      const rageResult = await rageService.addRage(
        groupId,
        C.RAGE_PER_TRAINING
      );

      if (rageResult.triggeredEvent) {
        await erisEventService.announceEvent(
          ctx.telegram,
          rageResult.triggeredEvent,
          ctx.chat.id
        );
      }

      let text =
        `🏋️ <b>تمرین با موفقیت انجام شد</b>\n\n⭐ +${C.TRAINING_XP_REWARD} XP`;

      if (result.statGained) {
        text += `\n📈 +1 ${
          STAT_LABELS[result.statGained] || result.statGained
        }`;
      }

      if (result.xpResult.leveledUp) {
        text +=
          `\n\n🎉 ارتقای سطح! اکنون به سطح ${result.xpResult.stats.level} رسیده‌اید.`;
      }

      text += `\n\nEris: "${erisVoice.say('training_done')}"`;

      await ctx.reply(
        text,
        { parse_mode: 'HTML', ...mainMenu() }
      );
    }
  );
}

module.exports = { register };