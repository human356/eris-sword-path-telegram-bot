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

// ---------- Level-scaled stamina (spec §4) ----------

/** Max stamina capacity at a given level: BASE_STAMINA + 15 per level above 1. */
function maxStaminaForLevel(level) {
  return C.BASE_STAMINA + C.STAMINA_CAPACITY_PER_LEVEL * Math.max(0, level - 1);
}

/** Stamina regen rate (points/minute) at a given level: 5% faster per level. */
function staminaRegenRatePerMinute(level) {
  return C.STAMINA_REGEN_BASE_PER_MINUTE * (1 + C.STAMINA_REGEN_SPEEDUP_PER_LEVEL * Math.max(0, level - 1));
}

// ---------- Level-scaled HP (spec §6) ----------

/** Max HP pool at a given level: 100 at level 1, growing per HP_CAPACITY_PER_LEVEL. */
function maxHpForLevel(level) {
  return C.BASE_HP + C.HP_CAPACITY_PER_LEVEL * Math.max(0, level - 1);
}

/** HP regen rate (points/minute) at a given level. */
function hpRegenRatePerMinute(level) {
  return C.HP_REGEN_PER_MINUTE * (1 + C.HP_REGEN_SPEEDUP_PER_LEVEL * Math.max(0, level - 1));
}

module.exports = {
  xpRequiredForLevel,
  applyXpGain,
  regenSince,
  winRate,
  maxStaminaForLevel,
  staminaRegenRatePerMinute,
  maxHpForLevel,
  hpRegenRatePerMinute,
};
