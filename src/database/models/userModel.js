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

async function setBanned(telegramId, isBanned) {
  const { rows } = await query(
    'UPDATE users SET is_banned = $2, updated_at = now() WHERE telegram_id = $1 RETURNING *',
    [telegramId, isBanned]
  );
  return rows[0] || null;
}

module.exports = { upsertUser, getUser, setBanned };
