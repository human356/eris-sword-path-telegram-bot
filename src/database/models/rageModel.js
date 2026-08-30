'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');

async function getRage(groupId) {
  const { rows } = await query('SELECT * FROM eris_rage WHERE group_id = $1', [groupId]);
  return rows[0] ? Number(rows[0].rage) : 0;
}

/** Adds `amount` (can be negative) to a group's rage, clamped to [0, RAGE_MAX]. Returns new value. */
async function addRage(groupId, amount) {
  const { rows } = await query(
    `INSERT INTO eris_rage (group_id, rage) VALUES ($1, GREATEST(0, LEAST($2::numeric, $3::numeric)))
     ON CONFLICT (group_id) DO UPDATE
     SET rage = GREATEST(0, LEAST(eris_rage.rage + $2::numeric, $3::numeric)), updated_at = now()
     RETURNING rage`,
    [groupId, amount, C.RAGE_MAX]
  );
  return Number(rows[0].rage);
}

async function resetRage(groupId) {
  await query('UPDATE eris_rage SET rage = 0, updated_at = now() WHERE group_id = $1', [groupId]);
}

module.exports = { getRage, addRage, resetRage };
