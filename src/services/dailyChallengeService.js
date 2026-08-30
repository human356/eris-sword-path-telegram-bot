'use strict';
const dailyModel = require('../database/models/dailyChallengeModel');

const CHALLENGE_DEFS = {
  WIN_3_DUELS: {
    label: 'Win 3 duels today.',
    target: 3,
    xp: 100, coins: 150, respect: 5,
  },
  BEAT_HIGHER_RATED: {
    label: 'Defeat a player with a higher Rating than you.',
    target: 1,
    xp: 300, coins: 400, respect: 10,
  },
  TRAIN_TWICE: {
    label: 'Complete 2 training sessions today.',
    target: 2,
    xp: 120, coins: 150, respect: 5,
  },
};

function pickRandomChallenge() {
  const keys = Object.keys(CHALLENGE_DEFS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return { challengeKey: key, target: CHALLENGE_DEFS[key].target };
}

/** Call after a PvP duel finishes for the winner. */
async function onDuelWin(telegramId, groupId, { beatHigherRated }) {
  try {
    await dailyModel.incrementProgress(telegramId, groupId, 'WIN_3_DUELS', 1);
    if (beatHigherRated) {
      await dailyModel.incrementProgress(telegramId, groupId, 'BEAT_HIGHER_RATED', 1);
    }
  } catch {
    // The player may not have today's challenge assigned yet (never ran /daily) — safe to ignore.
  }
}

/** Call after a training session completes. */
async function onTrainingComplete(telegramId, groupId) {
  try {
    await dailyModel.incrementProgress(telegramId, groupId, 'TRAIN_TWICE', 1);
  } catch {
    // Same as above — no-op if the player has no challenge assigned today.
  }
}

module.exports = { CHALLENGE_DEFS, pickRandomChallenge, onDuelWin, onTrainingComplete };
