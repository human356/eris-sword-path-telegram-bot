'use strict';
const C = require('../config/constants');
const playerStatsModel = require('../database/models/playerStatsModel');
const trainingLogModel = require('../database/models/trainingLogModel');
const cooldownModel = require('../database/models/cooldownModel');
const xpService = require('../ranking/xpService');
const dailyChallengeService = require('../services/dailyChallengeService');

const TRAINING_COOLDOWN_ACTION = 'training';

async function getTrainingCooldownRemaining(telegramId, groupId) {
  return cooldownModel.getRemainingCooldown(telegramId, groupId, TRAINING_COOLDOWN_ACTION);
}

/**
 * Runs one training session. `trainingKey` is one of C.TRAINING_TYPES keys.
 * Returns { success, reason?, stats, xpResult, statGained }.
 */
async function train(telegramId, groupId, stats, trainingKey) {
  const remaining = await getTrainingCooldownRemaining(telegramId, groupId);
  if (remaining > 0) {
    return { success: false, reason: 'COOLDOWN', remaining };
  }

  const type = C.TRAINING_TYPES[trainingKey];
  if (!type) {
    return { success: false, reason: 'INVALID_TYPE' };
  }

  if (stats.stamina < C.TRAINING_STAMINA_COST) {
    return { success: false, reason: 'NO_STAMINA' };
  }

  let statGained = null;
  const patch = {
    stamina: stats.stamina - C.TRAINING_STAMINA_COST,
    total_training: stats.total_training + 1,
  };

  const rolledGain = Math.random() < C.TRAINING_STAT_GAIN_CHANCE;
  if (rolledGain) {
    if (type.stat === 'crit_chance') {
      patch.crit_chance = Number(stats.crit_chance) + (type.gainAmount || 0.005);
    } else {
      patch[type.stat] = stats[type.stat] + 1;
    }
    statGained = type.stat;
  }

  const updatedStats = await playerStatsModel.updatePlayerStats(telegramId, groupId, patch);

  const xpResult = await xpService.grantXp(
    telegramId, groupId, updatedStats, C.TRAINING_XP_REWARD
  );

  await trainingLogModel.recordTraining({
    telegramId, groupId, trainingType: trainingKey, statGained,
  });

  await cooldownModel.setCooldown(telegramId, groupId, TRAINING_COOLDOWN_ACTION, C.TRAINING_COOLDOWN_SECONDS);
  await dailyChallengeService.onTrainingComplete(telegramId, groupId);

  return { success: true, stats: xpResult.stats, xpResult, statGained, type };
}

module.exports = { train, getTrainingCooldownRemaining };
