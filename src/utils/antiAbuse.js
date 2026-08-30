'use strict';
const C = require('../config/constants');
const { countRecentDuelsBetween } = require('../database/models/transactionModel');

/**
 * Returns a 0..1 multiplier to apply to XP/Coin/Rating rewards for a duel
 * between two specific players, based on how many times they've already
 * fought each other recently (spec §14, §25). 1 == full reward, 0 == none.
 */
async function getDuplicateOpponentRewardScale(groupId, playerA, playerB) {
  const priorDuels = await countRecentDuelsBetween(
    groupId, playerA, playerB, C.DUPLICATE_OPPONENT_WINDOW_HOURS
  );
  const scale = C.DUPLICATE_OPPONENT_REWARD_SCALE;
  if (priorDuels >= scale.length) return 0;
  return scale[priorDuels];
}

module.exports = { getDuplicateOpponentRewardScale };
