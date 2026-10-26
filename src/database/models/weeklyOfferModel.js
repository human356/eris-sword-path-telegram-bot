'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');
const itemsCatalog = require('../../config/items.json');

const DISCOUNTABLE_CATEGORIES = new Set(['CONSUMABLE', 'CARD', 'MYSTERY', 'PROFILE_TEMPLATE']);

function pickOffers() {
  const pool = Object.keys(itemsCatalog).filter((k) => {
    const def = itemsCatalog[k];
    return def.purchasable && DISCOUNTABLE_CATEGORIES.has(def.category);
  });
  const picked = [];
  while (picked.length < Math.min(C.WEEKLY_OFFER_COUNT, pool.length)) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    const percent = C.WEEKLY_OFFER_PERCENTS[Math.floor(Math.random() * C.WEEKLY_OFFER_PERCENTS.length)];
    picked.push({ key, percent });
  }
  return picked;
}

async function getLatest() {
  const { rows } = await query('SELECT * FROM weekly_offers ORDER BY id DESC LIMIT 1');
  return rows[0] || null;
}

/**
 * Current weekly discounts, generated lazily (no cron needed) the first time
 * they're asked for after the previous week's row has expired. Global across
 * every group, like the decorative rotation.
 * Returns { id, items: [{ key, percent }], expires_at, generated_at }.
 */
async function getActiveOffers() {
  const latest = await getLatest();
  if (latest && new Date(latest.expires_at).getTime() > Date.now()) return latest;

  const expiresAt = new Date(Date.now() + C.WEEKLY_OFFER_DAYS * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    'INSERT INTO weekly_offers (items, expires_at) VALUES ($1::jsonb, $2) RETURNING *',
    [JSON.stringify(pickOffers()), expiresAt]
  );
  return rows[0];
}

/** Discount percent (0 when none) currently applied to `itemKey`. */
async function getDiscountPercent(itemKey) {
  const offers = await getActiveOffers();
  const hit = (offers.items || []).find((o) => o.key === itemKey);
  return hit ? hit.percent : 0;
}

module.exports = { getActiveOffers, getDiscountPercent, DISCOUNTABLE_CATEGORIES };
