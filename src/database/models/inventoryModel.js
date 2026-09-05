'use strict';
const { query } = require('../pool');

/** Returns [{ item_key, quantity }] for items the player actually still has. */
async function getInventory(telegramId, groupId) {
  const { rows } = await query(
    `SELECT item_key, quantity FROM inventory_items
     WHERE telegram_id = $1 AND group_id = $2 AND quantity > 0
     ORDER BY item_key`,
    [telegramId, groupId]
  );
  return rows;
}

async function getItemQuantity(telegramId, groupId, itemKey) {
  const { rows } = await query(
    'SELECT quantity FROM inventory_items WHERE telegram_id = $1 AND group_id = $2 AND item_key = $3',
    [telegramId, groupId, itemKey]
  );
  return rows[0] ? rows[0].quantity : 0;
}

/**
 * Adds `amount` of an item, capped at `stackLimit` (defaults to effectively
 * unlimited). Returns the resulting quantity.
 */
async function addItem(telegramId, groupId, itemKey, amount, stackLimit = Number.MAX_SAFE_INTEGER) {
  const limit = stackLimit == null ? Number.MAX_SAFE_INTEGER : stackLimit;
  const { rows } = await query(
    `INSERT INTO inventory_items (telegram_id, group_id, item_key, quantity, updated_at)
     VALUES ($1, $2, $3, LEAST($4, $5), now())
     ON CONFLICT (telegram_id, group_id, item_key) DO UPDATE
     SET quantity = LEAST(inventory_items.quantity + $4, $5), updated_at = now()
     RETURNING quantity`,
    [telegramId, groupId, itemKey, amount, limit]
  );
  return rows[0].quantity;
}

/**
 * Removes `amount` of an item if (and only if) the player has enough.
 * Returns the resulting quantity, or null if there wasn't enough to remove.
 */
async function removeItem(telegramId, groupId, itemKey, amount) {
  const { rows } = await query(
    `UPDATE inventory_items SET quantity = quantity - $4, updated_at = now()
     WHERE telegram_id = $1 AND group_id = $2 AND item_key = $3 AND quantity >= $4
     RETURNING quantity`,
    [telegramId, groupId, itemKey, amount]
  );
  return rows[0] ? rows[0].quantity : null;
}

module.exports = { getInventory, getItemQuantity, addItem, removeItem };
