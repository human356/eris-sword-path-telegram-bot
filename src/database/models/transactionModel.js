'use strict';
const { query } = require('../pool');

async function recordTransaction({
  telegramId, groupId, type, coinsDelta = 0, xpDelta = 0, ratingDelta = 0, metadata = {},
}) {
  await query(
    `INSERT INTO transactions (telegram_id, group_id, type, coins_delta, xp_delta, rating_delta, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [telegramId, groupId, type, coinsDelta, xpDelta, ratingDelta, JSON.stringify(metadata)]
  );
}

/** Count how many PVP transactions exist between two specific players within a time window (anti-abuse §25). */
async function countRecentDuelsBetween(groupId, playerA, playerB, windowHours) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS cnt FROM battles
     WHERE group_id = $1
       AND state = 'FINISHED'
       AND updated_at > now() - make_interval(hours => $2::int)
       AND ((challenger_id = $3 AND opponent_id = $4) OR (challenger_id = $4 AND opponent_id = $3))`,
    [groupId, windowHours, playerA, playerB]
  );
  return rows[0].cnt;
}

module.exports = { recordTransaction, countRecentDuelsBetween };
