'use strict';
const { query, withTransaction } = require('../pool');
const inventoryModel = require('./inventoryModel');
const itemsCatalog = require('../../config/items.json');

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
 * Sets one slot (1-5) to a card key. Callers are responsible for checking
 * ownership and that the player isn't mid-battle (see inventory.js) — this
 * model stays intentionally dumb about game rules.
 */
async function setSlot(telegramId, groupId, slot, cardKey) {
  await getLoadout(telegramId, groupId); // ensure the row exists first
  await query(
    `UPDATE player_loadout SET card_key = $4
     WHERE telegram_id = $1 AND group_id = $2 AND slot = $3`,
    [telegramId, groupId, slot, cardKey]
  );
}

/**
 * Cards a player is allowed to slot in: the 5 starter moves, plus any
 * items.json entry with category "CARD" they currently hold in inventory.
 * (No CARD items exist yet — that's Phase 4 — so today this just returns
 * the 5 starters, but the mechanism is ready.)
 */
async function getOwnedCardKeys(telegramId, groupId) {
  const owned = new Set(STARTER_LOADOUT);
  const items = await inventoryModel.getInventory(telegramId, groupId);
  for (const row of items) {
    const def = itemsCatalog[row.item_key];
    if (def && def.category === 'CARD' && row.quantity > 0) {
      owned.add(row.item_key);
    }
  }
  return Array.from(owned);
}

module.exports = { STARTER_LOADOUT, getLoadout, setSlot, getOwnedCardKeys };
