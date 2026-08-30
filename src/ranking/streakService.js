'use strict';
const C = require('../config/constants');

/** Given a current streak count, returns the applicable reward multiplier (spec §14). */
function getStreakMultiplier(streak) {
  let multiplier = 1;
  for (const tier of C.STREAK_BONUS_TIERS) {
    if (streak >= tier.minStreak) multiplier = tier.rewardMultiplier;
  }
  return multiplier;
}

function getStreakRageBonus(streak) {
  if (streak < 3) return 0;
  const scaled = Math.min(C.RAGE_PER_STREAK_MAX, C.RAGE_PER_STREAK_MIN + Math.floor(streak / 3));
  return scaled;
}

/** Applies a win: returns { currentStreak, bestStreak, hitEventThreshold, hitAchievementThreshold }. */
function applyWinStreak(currentStreak, bestStreak) {
  const newStreak = currentStreak + 1;
  const newBest = Math.max(bestStreak, newStreak);
  return {
    currentStreak: newStreak,
    bestStreak: newBest,
    hitEventThreshold: newStreak === C.STREAK_FOR_ERIS_CHALLENGE,
    hitAchievementThreshold: newStreak === C.STREAK_FOR_ACHIEVEMENT,
  };
}

function applyLossStreak() {
  return { currentStreak: 0 };
}

module.exports = { getStreakMultiplier, getStreakRageBonus, applyWinStreak, applyLossStreak };
