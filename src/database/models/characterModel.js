'use strict';
const { query } = require('../pool');
const P = require('../../character/parts');
const itemsCatalog = require('../../config/items.json');
const inventoryModel = require('./inventoryModel');

const DOLL_KEY = 'CHARACTER_DOLL';

/** Gear ids (parts.GEAR keys) the player owns in this group: bought items + the free default set. */
async function getOwnedGear(telegramId, groupId) {
  const inv = await inventoryModel.getInventory(telegramId, groupId);
  const owned = new Set(Object.entries(P.GEAR).filter(([, g]) => g.free).map(([id]) => id));
  for (const row of inv) {
    const def = itemsCatalog[row.item_key];
    if (def && def.category === 'CHARACTER_GEAR' && def.gear && row.quantity > 0) owned.add(def.gear.id);
  }
  return owned;
}

async function hasCharacter(telegramId, groupId) {
  return (await inventoryModel.getItemQuantity(telegramId, groupId, DOLL_KEY)) > 0;
}

/** { appearance, outfit } — always complete & valid (defaults when nothing is saved yet). */
async function getCharacter(telegramId, groupId) {
  const { rows } = await query(
    'SELECT appearance, outfit FROM player_character WHERE telegram_id = $1 AND group_id = $2',
    [telegramId, groupId]
  );
  const row = rows[0] || {};
  const owned = await getOwnedGear(telegramId, groupId);
  return {
    appearance: P.sanitizeAppearance(row.appearance),
    outfit: P.sanitizeOutfit(row.outfit, owned),
    saved: !!rows[0],
  };
}

async function saveCharacter(telegramId, groupId, appearanceIn, outfitIn) {
  const owned = await getOwnedGear(telegramId, groupId);
  const appearance = P.sanitizeAppearance(appearanceIn);
  const outfit = P.sanitizeOutfit(outfitIn, owned);
  await query(
    `INSERT INTO player_character (telegram_id, group_id, appearance, outfit, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
     ON CONFLICT (telegram_id, group_id)
     DO UPDATE SET appearance = EXCLUDED.appearance, outfit = EXCLUDED.outfit, updated_at = now()`,
    [telegramId, groupId, JSON.stringify(appearance), JSON.stringify(outfit)]
  );
  return { appearance, outfit };
}

/** Groups where the player owns the doll: [{ group_id, group_name }]. */
async function listUnlockedGroups(telegramId) {
  const { rows } = await query(
    `SELECT g.group_id, g.group_name
     FROM inventory_items i JOIN groups g ON g.group_id = i.group_id
     WHERE i.telegram_id = $1 AND i.item_key = $2 AND i.quantity > 0
     ORDER BY g.group_name`,
    [telegramId, DOLL_KEY]
  );
  return rows;
}

module.exports = { DOLL_KEY, getOwnedGear, hasCharacter, getCharacter, saveCharacter, listUnlockedGroups };
