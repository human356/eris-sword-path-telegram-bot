'use strict';
const { query } = require('../pool');

async function getOrCreateTodayChallenge(telegramId, groupId, pickChallengeFn) {
  const existing = await query(
    `SELECT * FROM daily_challenges
     WHERE telegram_id = $1 AND group_id = $2 AND assigned_date = CURRENT_DATE`,
    [telegramId, groupId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const { challengeKey, target } = pickChallengeFn();
  const { rows } = await query(
    `INSERT INTO daily_challenges (telegram_id, group_id, challenge_key, target)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id, group_id, assigned_date) DO UPDATE SET challenge_key = daily_challenges.challenge_key
     RETURNING *`,
    [telegramId, groupId, challengeKey, target]
  );
  return rows[0];
}

async function incrementProgress(telegramId, groupId, challengeKey, amount = 1) {
  const { rows } = await query(
    `UPDATE daily_challenges
     SET progress = LEAST(target, progress + $4)
     WHERE telegram_id = $1 AND group_id = $2 AND assigned_date = CURRENT_DATE AND challenge_key = $3
     RETURNING *`,
    [telegramId, groupId, challengeKey, amount]
  );
  const row = rows[0];
  if (row && row.progress >= row.target && !row.completed) {
    const done = await query(
      `UPDATE daily_challenges SET completed = TRUE WHERE id = $1 RETURNING *`,
      [row.id]
    );
    return done.rows[0];
  }
  return row || null;
}

async function markClaimed(id) {
  const { rows } = await query(
    'UPDATE daily_challenges SET claimed = TRUE WHERE id = $1 AND completed = TRUE AND claimed = FALSE RETURNING *',
    [id]
  );
  return rows[0] || null;
}

module.exports = { getOrCreateTodayChallenge, incrementProgress, markClaimed };
