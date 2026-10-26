'use strict';
const { query } = require('../pool');

async function getImage(slotKey) {
  const { rows } = await query('SELECT * FROM bot_images WHERE slot_key = $1', [slotKey]);
  return rows[0] || null;
}

async function upsertImage({ slotKey, fileId, fileUniqueId = null, source = 'admin', assetSig = null, updatedBy = null }) {
  const { rows } = await query(
    `INSERT INTO bot_images (slot_key, file_id, file_unique_id, source, asset_sig, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (slot_key) DO UPDATE
     SET file_id = EXCLUDED.file_id, file_unique_id = EXCLUDED.file_unique_id, source = EXCLUDED.source,
         asset_sig = EXCLUDED.asset_sig, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING *`,
    [slotKey, fileId, fileUniqueId, source, assetSig, updatedBy]
  );
  return rows[0];
}

async function deleteImage(slotKey) {
  const { rowCount } = await query('DELETE FROM bot_images WHERE slot_key = $1', [slotKey]);
  return rowCount > 0;
}

/** All rows whose slot_key starts with `prefix` (e.g. "level:"). Prefix is matched literally. */
async function listByPrefix(prefix) {
  const { rows } = await query(
    `SELECT * FROM bot_images WHERE left(slot_key, char_length($1)) = $1 ORDER BY slot_key`,
    [prefix]
  );
  return rows;
}

module.exports = { getImage, upsertImage, deleteImage, listByPrefix };
