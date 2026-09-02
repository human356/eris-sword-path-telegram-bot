'use strict';
const { query, withTransaction } = require('../pool');

// These match battleEngine.MOVES exactly — every player starts with exactly
// these 5 in their 5 loadout slots (spec: "در ابتدا فقط ۵ کارت ابتدایی").
const STARTER_LOADOUT = ['ATTACK', 'GUARD', 'DODGE', 'HEAVY_ATTACK', 'COUNTER'];

async function readLoadoutRows(telegramId, groupId) {
  const { rows } = await query(
    'SELECT slot, card_key FROM player_loadout WHERE telegram_id = $1 AND group_id = $2 ORDER BY slot',
    [telegramId, groupId]
  );
  return rows;
}

/** Returns an ordered array of 5 card keys, creating the starter loadout on first read. */
async function getLoadout(telegramId, groupId) {
  const existing = await readLoadoutRows(telegramId, groupId);
  if (existing.length === 5) return existing.map((r) => r.card_key);

  await withTransaction(async (client) => {
    for (let i = 0; i < STARTER_LOADOUT.length; i += 1) {
      await client.query(
        `INSERT INTO player_loadout (telegram_id, group_id, slot, card_key)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (telegram_id, group_id, slot) DO NOTHING`,
        [telegramId, groupId, i + 1, STARTER_LOADOUT[i]]
      );
    }
  });

  const fresh = await readLoadoutRows(telegramId, groupId);
  return fresh.map((r) => r.card_key);
}

/**
 * Sets one slot (1-5) to a card key. Ownership/eligibility checks (does the
 * player actually own this card, are they mid-battle, etc.) belong to the
 * caller — this model is intentionally dumb. Wired up fully in Phase 2.
 */
async function setSlot(telegramId, groupId, slot, cardKey) {
  await getLoadout(telegramId, groupId); // ensure the row exists first
  await query(
    `UPDATE player_loadout SET card_key = $4
     WHERE telegram_id = $1 AND group_id = $2 AND slot = $3`,
    [telegramId, groupId, slot, cardKey]
  );
}

module.exports = { STARTER_LOADOUT, getLoadout, setSlot };
