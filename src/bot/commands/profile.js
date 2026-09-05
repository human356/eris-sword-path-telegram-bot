'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const showcaseModel = require('../../database/models/showcaseModel');
const { renderProfile, renderWelcome } = require('../views/profileView');
const { mainMenu } = require('../keyboards');
const { regenSince, staminaRegenRatePerMinute, hpRegenRatePerMinute } = require('../../utils/formulas');

async function applyPassiveRegen(telegramId, groupId, stats) {
  const staminaRate = staminaRegenRatePerMinute(stats.level);
  const hpRate = hpRegenRatePerMinute(stats.level);

  const newStamina = regenSince(stats.last_stamina_regen_at, stats.stamina, stats.max_stamina, staminaRate);
  const newHp = regenSince(stats.last_hp_regen_at, stats.hp, stats.max_hp, hpRate);

  // Only reset the timer for whichever stat actually ticked up — resetting
  // both unconditionally (the old behavior) throws away fractional regen
  // progress on the stat that didn't tick this time, which matters more now
  // that HP and stamina regen at different, level-scaled speeds.
  const patch = {};
  if (newStamina !== stats.stamina) {
    patch.stamina = newStamina;
    patch.last_stamina_regen_at = new Date();
  }
  if (newHp !== stats.hp) {
    patch.hp = newHp;
    patch.last_hp_regen_at = new Date();
  }

  if (Object.keys(patch).length === 0) return stats;
  return playerStatsModel.updatePlayerStats(telegramId, groupId, patch);
}

function register(bot) {
  bot.command(['start', 'profile', 'panel'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const { stats, created } = await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId);
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);

    if (created) {
      await ctx.reply(renderWelcome(user.displayName, finalStats), { parse_mode: 'HTML', ...mainMenu() });
      return;
    }

    // Phase 6: decorative showcase items chosen from «جیب من» are shown here.
    const showcaseItems = await showcaseModel.getShowcase(user.telegramId, groupId);
    await ctx.reply(renderProfile(user.displayName, finalStats, showcaseItems), { parse_mode: 'HTML', ...mainMenu() });
  });

  bot.action('menu:profile', async (ctx) => {
    await ctx.answerCbQuery();
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);
    const showcaseItems = await showcaseModel.getShowcase(user.telegramId, groupId);
    await ctx.reply(renderProfile(user.displayName, finalStats, showcaseItems), { parse_mode: 'HTML', ...mainMenu() });
  });
}

module.exports = { register, applyPassiveRegen };
