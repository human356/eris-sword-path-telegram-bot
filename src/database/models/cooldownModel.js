'use strict';
const { query } = require('../pool');

/** Returns remaining seconds (0 if not on cooldown). */
async function getRemainingCooldown(telegramId, groupId, action) {
  const { rows } = await query(
    'SELECT available_at FROM cooldowns WHERE telegram_id = $1 AND group_id = $2 AND action = $3',
    [telegramId, groupId, action]
  );
  if (!rows[0]) return 0;
  const remainingMs = new Date(rows[0].available_at).getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

async function setCooldown(telegramId, groupId, action, seconds) {
  const availableAt = new Date(Date.now() + seconds * 1000);
  await query(
    `INSERT INTO cooldowns (telegram_id, group_id, action, available_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id, group_id, action)
     DO UPDATE SET available_at = EXCLUDED.available_at`,
    [telegramId, groupId, action, availableAt]
  );
}

module.exports = { getRemainingCooldown, setCooldown };
