'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');

/** Returns an ordered array (slot 1..PLAYER_SHOWCASE_SLOTS) of item_key or null for empty slots. */
async function getShowcase(telegramId, groupId) {
  const { rows } = await query(
    'SELECT slot, item_key FROM player_showcase WHERE telegram_id = $1 AND group_id = $2 ORDER BY slot',
    [telegramId, groupId]
  );
  const bySlot = new Map(rows.map((r) => [r.slot, r.item_key]));
  const result = [];
  for (let i = 1; i <= C.PLAYER_SHOWCASE_SLOTS; i += 1) {
    result.push(bySlot.get(i) || null);
  }
  return result;
}

/** Sets (or clears, if itemKey is null) one showcase slot. */
async function setSlot(telegramId, groupId, slot, itemKey) {
  if (itemKey === null) {
    await query(
      'DELETE FROM player_showcase WHERE telegram_id = $1 AND group_id = $2 AND slot = $3',
      [telegramId, groupId, slot]
    );
    return;
  }
  await query(
    `INSERT INTO player_showcase (telegram_id, group_id, slot, item_key)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id, group_id, slot) DO UPDATE SET item_key = EXCLUDED.item_key`,
    [telegramId, groupId, slot, itemKey]
  );
}

module.exports = { getShowcase, setSlot };
