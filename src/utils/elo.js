'use strict';
const C = require('../config/constants');

/**
 * Simplified ELO (spec §8): winner gains between RATING_MIN_GAIN and
 * RATING_MAX_GAIN depending on the opponent's relative strength, loser loses
 * a mirrored (but floor-clamped) amount so ratings can't go negative.
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

function computeEloDelta(winnerRating, loserRating) {
  const expectedWin = expectedScore(winnerRating, loserRating);
  const rawGain = C.ELO_K_FACTOR * (1 - expectedWin);
  const winnerGain = Math.round(
    Math.min(C.RATING_MAX_GAIN, Math.max(C.RATING_MIN_GAIN, rawGain))
  );
  const loserLoss = Math.round(Math.min(winnerGain, rawGain));
  return { winnerGain, loserLoss };
}

module.exports = { computeEloDelta, expectedScore };
