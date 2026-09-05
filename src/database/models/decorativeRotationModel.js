'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');
const itemsCatalog = require('../../config/items.json');

function pickRandomDecorativeKeys(count) {
  const all = Object.keys(itemsCatalog).filter((k) => itemsCatalog[k].category === 'DECORATIVE');
  const pool = [...all];
  const picked = [];
  while (picked.length < Math.min(count, pool.length)) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

async function getLatestRotation() {
  const { rows } = await query('SELECT * FROM decorative_shop_rotation ORDER BY id DESC LIMIT 1');
  return rows[0] || null;
}

async function insertRotation(itemKeys) {
  const expiresAt = new Date(Date.now() + C.DECORATIVE_ROTATION_DAYS * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO decorative_shop_rotation (item_keys, expires_at) VALUES ($1, $2) RETURNING *`,
    [JSON.stringify(itemKeys), expiresAt]
  );
  return rows[0];
}

/**
 * Returns the currently active decorative-shop rotation, generating a fresh
 * one lazily (on read, no cron needed) if none exists yet or the previous
 * one has expired. Global across every group — user confirmed a single
 * shared rotation rather than a per-group one, for simplicity.
 */
async function getActiveRotation() {
  const latest = await getLatestRotation();
  if (latest && new Date(latest.expires_at).getTime() > Date.now()) {
    return latest;
  }
  const keys = pickRandomDecorativeKeys(C.DECORATIVE_ROTATION_SIZE);
  return insertRotation(keys);
}

module.exports = { getActiveRotation };
