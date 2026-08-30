'use strict';
const C = require('../config/constants');

function xpRequiredForLevel(level) {
  return C.xpRequiredForLevel(level);
}

/**
 * Applies gained XP to (level, xp), rolling over into as many level-ups as
 * earned. Returns { level, xp, leveledUp, levelsGained }.
 */
function applyXpGain(currentLevel, currentXp, xpGained) {
  let level = currentLevel;
  let xp = currentXp + xpGained;
  let levelsGained = 0;

  let required = xpRequiredForLevel(level);
  while (xp >= required) {
    xp -= required;
    level += 1;
    levelsGained += 1;
    required = xpRequiredForLevel(level);
  }

  return { level, xp, leveledUp: levelsGained > 0, levelsGained };
}

/** Passive regen since `lastRegenAt`, capped at max. Returns the new value. */
function regenSince(lastRegenAt, current, max, perMinute) {
  const minutesElapsed = (Date.now() - new Date(lastRegenAt).getTime()) / 60000;
  if (minutesElapsed <= 0) return current;
  const regenAmount = Math.floor(minutesElapsed * perMinute);
  return Math.min(max, current + regenAmount);
}

function winRate(wins, losses) {
  const total = wins + losses;
  if (total === 0) return 0;
  return wins / total;
}

module.exports = { xpRequiredForLevel, applyXpGain, regenSince, winRate };
