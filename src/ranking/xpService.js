'use strict';
const { applyXpGain } = require('../utils/formulas');
const { computeSwordRank } = require('../utils/rankUtil');
const playerStatsModel = require('../database/models/playerStatsModel');

/**
 * Applies XP gain, level-ups, and re-derives Sword Rank in one go.
 * Returns { stats, leveledUp, levelsGained, rankChanged, newRank }.
 */
async function grantXp(telegramId, groupId, stats, xpGained) {
  const { level, xp, leveledUp, levelsGained } = applyXpGain(stats.level, stats.xp, xpGained);

  const previousRank = stats.sword_rank;
  const candidateStats = { ...stats, level, xp };
  const newRank = computeSwordRank(candidateStats);
  const rankChanged = newRank.key !== previousRank;

  const updated = await playerStatsModel.updatePlayerStats(telegramId, groupId, {
    level, xp, sword_rank: newRank.key,
  });

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
