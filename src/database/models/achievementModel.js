'use strict';
const { query } = require('../pool');

/** Returns the achievement row if newly unlocked, or null if the player already had it. */
async function unlock(telegramId, groupId, achievementKey) {
  const { rows } = await query(
    `INSERT INTO achievements (telegram_id, group_id, achievement_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id, group_id, achievement_key) DO NOTHING
     RETURNING *`,
    [telegramId, groupId, achievementKey]
  );
  return rows[0] || null;
}

async function listForPlayer(telegramId, groupId) {
  const { rows } = await query(
    'SELECT * FROM achievements WHERE telegram_id = $1 AND group_id = $2 ORDER BY unlocked_at',
    [telegramId, groupId]
  );
  return rows;
}

module.exports = { unlock, listForPlayer };
