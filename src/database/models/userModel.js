'use strict';
const { query } = require('../pool');

async function upsertUser({ telegramId, username, displayName }) {
  const { rows } = await query(
    `INSERT INTO users (telegram_id, username, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id)
     DO UPDATE SET username = EXCLUDED.username,
                   display_name = EXCLUDED.display_name,
                   updated_at = now()
     RETURNING *`,
    [telegramId, username || null, displayName]
  );
  return rows[0];
}

async function getUser(telegramId) {
  const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return rows[0] || null;
}

/** Case-insensitive lookup by @username (without the @). */
async function getUserByUsername(username) {
  const { rows } = await query(
    'SELECT * FROM users WHERE lower(username) = lower($1) ORDER BY updated_at DESC LIMIT 1',
    [String(username || '').replace(/^@/, '')]
  );
  return rows[0] || null;
}

async function setBanned(telegramId, isBanned) {
  const { rows } = await query(
    'UPDATE users SET is_banned = $2, updated_at = now() WHERE telegram_id = $1 RETURNING *',
    [telegramId, isBanned]
  );
  return rows[0] || null;
}

/** Called the first time the user talks to the bot in private (= pressed Start). */
async function markStarted(telegramId) {
  const { rows } = await query(
    `UPDATE users SET started_bot = TRUE, started_at = COALESCE(started_at, now()), updated_at = now()
     WHERE telegram_id = $1 RETURNING *`,
    [telegramId]
  );
  return rows[0] || null;
}

/** Groups the player already has a profile in (used to pick the group for DM purchases). */
async function listGroupsOfPlayer(telegramId) {
  const { rows } = await query(
    `SELECT g.group_id, g.group_name
     FROM player_group_stats pgs
     JOIN groups g ON g.group_id = pgs.group_id
     WHERE pgs.telegram_id = $1
     ORDER BY pgs.last_activity_at DESC`,
    [telegramId]
  );
  return rows;
}

module.exports = { upsertUser, getUser, getUserByUsername, setBanned, markStarted, listGroupsOfPlayer };
