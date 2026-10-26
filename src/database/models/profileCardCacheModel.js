'use strict';
const { query } = require('../pool');

async function getCard(telegramId, groupId) {
  const { rows } = await query(
    'SELECT * FROM profile_card_cache WHERE telegram_id = $1 AND group_id = $2',
    [telegramId, groupId]
  );
  return rows[0] || null;
}

async function saveCard(telegramId, groupId, cardHash, fileId) {
  await query(
    `INSERT INTO profile_card_cache (telegram_id, group_id, card_hash, file_id, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (telegram_id, group_id) DO UPDATE
     SET card_hash = EXCLUDED.card_hash, file_id = EXCLUDED.file_id, updated_at = now()`,
    [telegramId, groupId, cardHash, fileId]
  );
}

async function deleteCard(telegramId, groupId) {
  await query('DELETE FROM profile_card_cache WHERE telegram_id = $1 AND group_id = $2', [telegramId, groupId]);
}

module.exports = { getCard, saveCard, deleteCard };
