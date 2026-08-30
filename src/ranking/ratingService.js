'use strict';
const { computeEloDelta } = require('../utils/elo');

/** Returns { winnerGain, loserLoss } for a finished duel. */
function computeDuelRatingDeltas(winnerRating, loserRating) {
  return computeEloDelta(winnerRating, loserRating);
}

module.exports = { computeDuelRatingDeltas };
