'use strict';
const { applyXpGain, maxHpForLevel, maxStaminaForLevel } = require('../utils/formulas');
const { computeSwordRank } = require('../utils/rankUtil');
const playerStatsModel = require('../database/models/playerStatsModel');

/**
 * Applies XP gain, level-ups, and re-derives Sword Rank in one go.
 * On level-up, also grows max HP/stamina (spec §4, §6) and tops up the
 * player's CURRENT hp/stamina by the same amount the cap grew, so leveling
 * up always feels like a net gain rather than just a bigger empty bucket.
 * Returns { stats, leveledUp, levelsGained, rankChanged, newRank }.
 */
async function grantXp(telegramId, groupId, stats, xpGained) {
  const { level, xp, leveledUp, levelsGained } = applyXpGain(stats.level, stats.xp, xpGained);

  const previousRank = stats.sword_rank;
  const candidateStats = { ...stats, level, xp };
  const newRank = computeSwordRank(candidateStats);
  const rankChanged = newRank.key !== previousRank;

  const patch = { level, xp, sword_rank: newRank.key };

  if (leveledUp) {
    const newMaxHp = maxHpForLevel(level);
    const newMaxStamina = maxStaminaForLevel(level);
    const hpCapGain = Math.max(0, newMaxHp - stats.max_hp);
    const staminaCapGain = Math.max(0, newMaxStamina - stats.max_stamina);

    patch.max_hp = newMaxHp;
    patch.max_stamina = newMaxStamina;
    patch.hp = Math.min(newMaxHp, stats.hp + hpCapGain);
    patch.stamina = Math.min(newMaxStamina, stats.stamina + staminaCapGain);
  }

  const updated = await playerStatsModel.updatePlayerStats(telegramId, groupId, patch);

  return { stats: updated, leveledUp, levelsGained, rankChanged, newRank };
}

/** Re-derives and persists Sword Rank without granting XP (e.g. after a rating change). */
async function syncRank(telegramId, groupId, stats) {
  const newRank = computeSwordRank(stats);
  if (newRank.key === stats.sword_rank) return { stats, rankChanged: false, newRank };
  const updated = await playerStatsModel.updatePlayerStats(telegramId, groupId, {
    sword_rank: newRank.key,
  });
  return { stats: updated, rankChanged: true, newRank };
}

module.exports = { grantXp, syncRank };
