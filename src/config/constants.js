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
  COINS_PVP_WIN: 40, // was 100 — battle-participation coins deliberately lowered (Phase 8)
  COINS_PVP_LOSS: 4, // was 10
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
  MAX_ROUNDS: 25, // hard cap so a duel can never drag on forever (spec §9/§10)
  // No HP-restoring ITEM (potion/rice — not cards) may be used once the duel
  // reaches this round (spec §9: "در راند ۲۴ و ۲۵ اجازهٔ مصرف هیچ آیتمی که
  // به سلامتی کمک کند داده نمی‌شود").
  HEAL_LOCK_START_ROUND: 24,

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

  // ---------- Background regen tick (all players, via cron) ----------
  // Every REGEN_TICK_MINUTES minutes each player regains this fraction of
  // their max stamina / max HP (always at least 1 point).
  REGEN_TICK_MINUTES: 3,
  STAMINA_REGEN_PERCENT_PER_TICK: 0.01,
  HP_REGEN_PERCENT_PER_TICK: 0.01,

  // ---------- PvE (training battle vs Eris) — EASY tuning ----------
  PVE_EASY_STAT_MULTIPLIER: 0.75, // Eris's attack/defense/speed/crit on EASY
  PVE_EASY_HP_MULTIPLIER: 0.8, // Eris's starting HP on EASY, relative to the player's max HP
  PVE_EASY_AGGRESSION: 0.5, // chance Eris picks an offensive move on EASY (others: 0.7)
  PVE_EASY_FUMBLE_CHANCE: 0.25, // chance Eris wastes the round guarding on EASY

  // ---------- Daily challenge ----------
  DAILY_CHALLENGE_COOLDOWN_HOURS: 24,

  // ---------- Anti-abuse: repeated-opponent PvP reward decay ----------
  // index 0 = 1st duel today between the same pair, etc. Beyond the array -> 0 reward.
  DUPLICATE_OPPONENT_REWARD_SCALE: [1, 1, 0.75, 0.5, 0.25],
  DUPLICATE_OPPONENT_WINDOW_HOURS: 24,
  FIGHT_COOLDOWN_SECONDS: 30, // minimum gap between two fight requests by the same user

  // ---------- Misc ----------
  LEADERBOARD_PAGE_SIZE: 10,

  // ---------- Multiplayer battle modes (spec §10) ----------
  MULTIPLAYER_RECRUIT_SECONDS: 90,
  FFA_MIN_PLAYERS: 3,
  FFA_MAX_PLAYERS: 4,
  FFA_MAX_ROUNDS: 25,
  TEAM_MIN_PLAYERS: 4, // 2v2 minimum
  TEAM_MAX_PLAYERS: 8, // 4v4 maximum
  TEAM_MAX_ROUNDS: 32,
  PVE_MAX_ROUNDS: 25,
  PVE_XP_REWARD: 30,
  PVE_COIN_REWARD: 15, // was 40 (a win adds +50%)

  // ================= PHASE 6 =================

  // ---------- Group chat cleanup ----------
  // Most bot messages sent into a GROUP chat are auto-deleted this long
  // after being sent, to stop the group from getting cluttered (user
  // request: "پاکسازی چت ربات در گروه‌ها"). The three exceptions — final
  // battle result, per-round battle report, training result — are sent
  // with the "persist" helper (src/utils/messageCleanup.js) instead and are
  // never auto-deleted. Private/DM messages (e.g. «جیب من») are never
  // touched by this at all — only group chats get cleaned up.
  BOT_MESSAGE_AUTODELETE_MS: 10 * 60 * 1000, // 10 minutes

  // ---------- Decorative items & weekly shop rotation ----------
  DECORATIVE_ROTATION_SIZE: 5, // how many DECORATIVE items the shop shows at once
  DECORATIVE_ROTATION_DAYS: 7, // how often the rotation refreshes (checked lazily, no cron needed)
  PLAYER_SHOWCASE_SLOTS: 3, // how many decorative items a player can display on /profile

  // ---------- Treasure Chest ----------
  TREASURE_CHEST_ROLL_COUNT: 10, // number of independent loot rolls per chest opened
  // Weighted loot table — weights are normalized against their own sum at
  // roll time, they don't need to add up to 100. `type` drives
  // treasureChestService.js's reward logic.
  TREASURE_CHEST_LOOT_TABLE: [
    { type: 'COINS', weight: 40, min: 50, max: 300 },
    { type: 'XP', weight: 30, min: 30, max: 200 },
    { type: 'CONSUMABLE_ITEM', weight: 15 },
    { type: 'DECORATIVE_ITEM', weight: 10 },
    { type: 'CARD_ITEM', weight: 5 },
  ],
  // If a CARD/DECORATIVE roll would give the player something they already
  // own (both are stack-limited to 1), it's swapped for this consolation
  // instead of being wasted — see spec §6.1.
  TREASURE_CHEST_FALLBACK_COINS: 150,
  TREASURE_CHEST_FALLBACK_XP: 80,

  // ================= PHASE 8 =================

  // ---------- Image-card profile ----------
  PROFILE_CARD_WIDTH: 1280,
  PROFILE_CARD_HEIGHT: 720, // 16:9
  PROFILE_CARD_JPEG_QUALITY: 92,
  PROFILE_CARD_XP_BAR_STEP_PERCENT: 2, // xp bar is quantised so tiny xp gains don't invalidate the cached card
  PROFILE_CARD_LAYOUT_VERSION: 1, // bump after editing src/config/profileLayout.js to force every card to re-render

  // ---------- /start gate ----------
  START_GATE_NOTICE_COOLDOWN_MS: 5 * 1000, // per user: don't flood the group if they spam commands

  // ---------- Weekly shop offers ----------
  WEEKLY_OFFER_COUNT: 3,
  WEEKLY_OFFER_PERCENTS: [10, 15, 20, 25, 30],
  WEEKLY_OFFER_DAYS: 7,
  SHOP_POST_SPACING_MS: 1500, // pause between product posts so groups' flood limit isn't hit
  SHOP_POST_SWEEP_CRON: '*/10 * * * *',
  SHOP_INLINE_MAX_RESULTS: 50,
};
