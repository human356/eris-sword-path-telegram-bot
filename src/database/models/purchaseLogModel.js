'use strict';
const { query } = require('../pool');

async function getTodayPurchasedQty(telegramId, groupId, itemKey) {
  const { rows } = await query(
    `SELECT COALESCE(SUM(quantity), 0)::int AS total FROM shop_purchase_log
     WHERE telegram_id = $1 AND group_id = $2 AND item_key = $3 AND purchased_date = CURRENT_DATE`,
    [telegramId, groupId, itemKey]
  );
  return rows[0].total;
}

async function recordPurchase(telegramId, groupId, itemKey, quantity) {
  await query(
    `INSERT INTO shop_purchase_log (telegram_id, group_id, item_key, quantity)
     VALUES ($1, $2, $3, $4)`,
    [telegramId, groupId, itemKey, quantity]
  );
}

module.exports = { getTodayPurchasedQty, recordPurchase };
