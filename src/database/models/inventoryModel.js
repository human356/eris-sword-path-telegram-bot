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
 *
 * IMPORTANT: items.json uses `"stackLimit": null` to mean "no cap" (e.g.
 * CAT_DOLL, POISON_SWAMP has a real number but CAT_DOLL/BADGE-type items
 * don't). A plain JS default parameter (`= Number.MAX_SAFE_INTEGER`) only
 * kicks in for `undefined`, NOT for `null` — so callers passing
 * `def.stackLimit` straight from items.json were sending a literal `NULL`
 * into `LEAST($4, $5)` in Postgres, which collapses the whole expression to
 * NULL and then fails the `quantity NOT NULL` constraint on
 * inventory_items. That silently broke shop purchases (after coins were
 * already spent!) and treasure chest rolls for any item with
 * `stackLimit: null`. Normalizing here fixes every caller in one place.
 */
// quantity is a Postgres INTEGER (int4); Number.MAX_SAFE_INTEGER overflows it
// ("value out of range for type integer"), so "unlimited" is int4's max instead.
const INT4_MAX = 2147483647;

async function addItem(telegramId, groupId, itemKey, amount, stackLimit = INT4_MAX) {
  const limit = (stackLimit === null || stackLimit === undefined) ? INT4_MAX : Math.min(stackLimit, INT4_MAX);

  // Explicit ::int casts: $4 is used in two different expression contexts, and
  // without them Postgres can deduce conflicting types for the same parameter
  // ("inconsistent types deduced for parameter $4"), failing EVERY purchase.
  const { rows } = await query(
    `INSERT INTO inventory_items (telegram_id, group_id, item_key, quantity, updated_at)
     VALUES ($1, $2, $3, LEAST($4::int, $5::int), now())
     ON CONFLICT (telegram_id, group_id, item_key) DO UPDATE
     SET quantity = LEAST(inventory_items.quantity + $4::int, $5::int), updated_at = now()
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
