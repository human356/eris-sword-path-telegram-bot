'use strict';
const C = require('../config/constants');
const { winRate } = require('./formulas');

/**
 * Sword Rank is derived from Level + Rating + duel count + win-rate + special
 * requirements (spec §7) — never from Level alone. Ranks are checked from
 * highest to lowest; the first one whose thresholds are all met wins.
 */
function computeSwordRank(stats) {
  const duels = stats.wins + stats.losses + stats.draws;
  const wr = winRate(stats.wins, stats.losses);

  for (const rank of C.SWORD_RANKS) {
    const meetsLevel = stats.level >= rank.minLevel;
    const meetsRating = stats.rating >= rank.minRating;
    const meetsDuels = duels >= rank.minDuels;
    const meetsWinRate = wr >= rank.minWinRate;
    const meetsChallenge = !rank.requiresErisChallengeWin || stats.has_won_eris_challenge;

    if (meetsLevel && meetsRating && meetsDuels && meetsWinRate && meetsChallenge) {
      return rank;
    }
  }
  return C.SWORD_RANKS[C.SWORD_RANKS.length - 1]; // BEGINNER fallback
}

function getRankByKey(key) {
  return C.SWORD_RANKS.find((r) => r.key === key) || null;
}

module.exports = { computeSwordRank, getRankByKey };
