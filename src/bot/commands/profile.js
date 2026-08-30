'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const { renderProfile, renderWelcome } = require('../views/profileView');
const { mainMenu } = require('../keyboards');
const { regenSince } = require('../../utils/formulas');
const C = require('../../config/constants');

async function applyPassiveRegen(telegramId, groupId, stats) {
  const newStamina = regenSince(stats.last_stamina_regen_at, stats.stamina, stats.max_stamina, C.STAMINA_REGEN_PER_MINUTE);
  const newHp = regenSince(stats.last_hp_regen_at, stats.hp, stats.max_hp, C.HP_REGEN_PER_MINUTE);
  if (newStamina !== stats.stamina || newHp !== stats.hp) {
    return playerStatsModel.updatePlayerStats(telegramId, groupId, {
      stamina: newStamina, hp: newHp,
      last_stamina_regen_at: new Date(), last_hp_regen_at: new Date(),
    });
  }
  return stats;
}

function register(bot) {
  bot.command(['start', 'profile', 'panel'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const { stats, created } = await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId);
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);

    const text = created ? renderWelcome(user.displayName, finalStats) : renderProfile(user.displayName, finalStats);
    await ctx.reply(text, { parse_mode: 'HTML', ...mainMenu() });
  });

  bot.action('menu:profile', async (ctx) => {
    await ctx.answerCbQuery();
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);
    await ctx.reply(renderProfile(user.displayName, finalStats), { parse_mode: 'HTML', ...mainMenu() });
  });
}

module.exports = { register, applyPassiveRegen };
