/**
 * All game balance numbers live here (spec §42).
 * Nothing below should be hard-coded anywhere else in the codebase —
 * import from this file instead so the game can be re-balanced from one place.
 */
'use strict';

module.exports = {
  // ---------- Base stats ----------
  BASE_HP: 100,
  BASE_STAMINA: 100,
  BASE_ATTACK: 20,
  BASE_DEFENSE: 15,
  BASE_SPEED: 15,
  BASE_CRIT_CHANCE: 0.10, // 10%
  BASE_COINS: 100,
  BASE_LEVEL: 1,

  // ---------- XP ----------
  XP_PVP_WIN: 50,
  XP_PVP_LOSS: 15,
  XP_TRAINING: 20,
  XP_DAILY_MIN: 50,
  XP_DAILY_MAX: 150,
  XP_ERIS_CHALLENGE_MIN: 100,
  XP_ERIS_CHALLENGE_MAX: 500,
  // Required XP for next level: 100 + (level * 50)
  xpRequiredForLevel(level) {
    return 100 + level * 50;
  },

  // ---------- Coins ----------
  COINS_PVP_WIN: 120,
  COINS_PVP_LOSS: 40,
  COINS_TRAINING: 10,
  COINS_DAILY_MIN: 100,
  COINS_DAILY_MAX: 400,

  // ---------- Rating (simplified ELO) ----------
  ELO_K_FACTOR: 32,
  RATING_MIN_GAIN: 15,
  RATING_MAX_GAIN: 50,
  RATING_STARTING: 1000,

  // ---------- Stamina costs per move ----------
  ATTACK_STAMINA_COST: 15,
  HEAVY_ATTACK_STAMINA_COST: 30,
  GUARD_STAMINA_COST: 5,
  DODGE_STAMINA_COST: 20,
  COUNTER_STAMINA_COST: 15,

  // ---------- Combat tuning ----------
  HEAVY_ATTACK_DAMAGE_MULTIPLIER: 1.8,
  HEAVY_ATTACK_ACCURACY: 0.70, // lower accuracy than a normal attack
  ATTACK_ACCURACY: 0.90,
  COUNTER_DAMAGE_MULTIPLIER: 1.6,
  GUARD_DAMAGE_REDUCTION: 0.75, // guard blocks 75% of incoming damage
  CRIT_DAMAGE_MULTIPLIER: 1.5,
  DODGE_BASE_CHANCE: 0.20, // + scales with Speed difference
  MAX_ROUNDS: 12, // hard cap so a duel can never drag on forever

  // ---------- Battle timing ----------
  CHALLENGE_TIMEOUT_SECONDS: 60,
  ROUND_TIMEOUT_SECONDS: 15,
  MAX_CONSECUTIVE_AFK_ROUNDS: 3, // forfeit after this many missed rounds in a row

  // ---------- Winning streak ----------
  STREAK_BONUS_TIERS: [
    { minStreak: 3, rewardMultiplier: 1.05 },
    { minStreak: 5, rewardMultiplier: 1.10 },
    { minStreak: 10, rewardMultiplier: 1.20 },
  ],
  STREAK_FOR_ERIS_CHALLENGE: 10,
  STREAK_FOR_ACHIEVEMENT: 20,

  // ---------- Eris Rage ----------
  RAGE_PER_PVP_WIN: 5,
  RAGE_PER_PVP_LOSS: 1,
  RAGE_PER_TRAINING: 2,
  RAGE_PER_CRIT: 1,
  RAGE_PER_UPSET_WIN: 8, // beating a notably stronger opponent
  RAGE_PER_STREAK_MIN: 1,
  RAGE_PER_STREAK_MAX: 5,
  RAGE_PER_DAILY: 5,
  RAGE_MAX: 100,
  RAGE_LEVELS: [
    { max: 20, key: 'CALM', label: '😐 Calm' },
    { max: 40, key: 'INTERESTED', label: '🙂 Interested' },
    { max: 60, key: 'ANNOYED', label: '😠 Annoyed' },
    { max: 80, key: 'ANGRY', label: '🔥 Angry' },
    { max: 99, key: 'FURIOUS', label: '💢 Furious' },
    { max: 100, key: 'ERIS_RAGE', label: '🔥🔥 ERIS RAGE' },
  ],
  ERIS_EVENT_DURATION_MINUTES: 10,

  // ---------- Sword Rank thresholds ----------
  // Order matters: highest rank first, first match wins.
  SWORD_RANKS: [
    {
      key: 'SWORD_GOD', label: '🟨 Sword God', order: 9,
      minLevel: 70, minRating: 2200, minWinRate: 0.65, minDuels: 200,
    },
    {
      key: 'SWORD_EMPEROR', label: '🟥 Sword Emperor', order: 8,
      minLevel: 60, minRating: 2000, minWinRate: 0.62, minDuels: 160,
    },
    {
      key: 'SWORD_KING', label: '🟥 Sword King', order: 7,
      minLevel: 45, minRating: 1700, minWinRate: 0.60, minDuels: 120,
      requiresErisChallengeWin: true,
    },
    {
      key: 'SWORD_SAINT', label: '🟪 Sword Saint', order: 6,
      minLevel: 30, minRating: 1300, minWinRate: 0.55, minDuels: 100,
    },
    {
      key: 'SWORD_ADEPT', label: '🟦 Sword Adept', order: 5,
      minLevel: 15, minRating: 900, minWinRate: 0, minDuels: 50,
    },
    {
      key: 'ADVANCED_SWORDSMAN', label: '🥈 Advanced Swordsman', order: 4,
      minLevel: 10, minRating: 700, minWinRate: 0, minDuels: 20,
    },
    {
      key: 'INTERMEDIATE_SWORDSMAN', label: '🥈 Intermediate Swordsman', order: 3,
      minLevel: 5, minRating: 0, minWinRate: 0, minDuels: 5,
    },
    {
      key: 'APPRENTICE_SWORDSMAN', label: '🥉 Apprentice Swordsman', order: 2,
      minLevel: 2, minRating: 0, minWinRate: 0, minDuels: 0,
    },
    {
      key: 'BEGINNER', label: '🥉 Beginner', order: 1,
      minLevel: 0, minRating: 0, minWinRate: 0, minDuels: 0,
    },
  ],

  // ---------- Training ----------
  TRAINING_STAMINA_COST: 20,
  TRAINING_XP_REWARD: 20,
  TRAINING_STAT_GAIN_CHANCE: 0.35,
  TRAINING_COOLDOWN_SECONDS: 20 * 60, // 20 minutes
  TRAINING_TYPES: {
    STRENGTH: { stat: 'attack', label: '⚔️ Strength' },
    SPEED: { stat: 'speed', label: '💨 Speed' },
    DEFENSE: { stat: 'defense', label: '🛡 Defense' },
    ACCURACY: { stat: 'crit_chance', label: '🎯 Accuracy', gainAmount: 0.005 },
  },

  // ---------- Stamina regeneration (spec §4) ----------
  // Level 1: one stamina point every 5 minutes -> 1/5 point per minute.
  STAMINA_REGEN_BASE_PER_MINUTE: 1 / 5,
  // Each level makes regen this much faster, relative to the base rate
  // (level L rate = BASE * (1 + SPEEDUP * (L - 1))) — level 21 regens 2x as
  // fast as level 1, for example.
  STAMINA_REGEN_SPEEDUP_PER_LEVEL: 0.05,
  // Max stamina at level L = BASE_STAMINA + this * (L - 1).
  STAMINA_CAPACITY_PER_LEVEL: 15,

  // ---------- HP regeneration (spec §6) ----------
  // Base rate at level 1 (points per minute, outside of battle only).
  HP_REGEN_PER_MINUTE: 2,
  // Same growth model as stamina above — tune freely, spec only says
  // "faster regen + bigger pool per level" without exact numbers.
  HP_REGEN_SPEEDUP_PER_LEVEL: 0.05,
  // Max HP at level L = BASE_HP + this * (L - 1). BASE_HP (100) is the
  // level-1 starting pool the spec calls out explicitly.
  HP_CAPACITY_PER_LEVEL: 10,

  // ---------- Daily challenge ----------
  DAILY_CHALLENGE_COOLDOWN_HOURS: 24,

  // ---------- Anti-abuse: repeated-opponent PvP reward decay ----------
  // index 0 = 1st duel today between the same pair, etc. Beyond the array -> 0 reward.
  DUPLICATE_OPPONENT_REWARD_SCALE: [1, 1, 0.75, 0.5, 0.25],
  DUPLICATE_OPPONENT_WINDOW_HOURS: 24,
  FIGHT_COOLDOWN_SECONDS: 30, // minimum gap between two fight requests by the same user

  // ---------- Misc ----------
  LEADERBOARD_PAGE_SIZE: 10,
};
