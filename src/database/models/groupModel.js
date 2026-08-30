'use strict';
const { query } = require('../pool');

async function upsertGroup({ groupId, groupName }) {
  const { rows } = await query(
    `INSERT INTO groups (group_id, group_name)
     VALUES ($1, $2)
     ON CONFLICT (group_id)
     DO UPDATE SET group_name = EXCLUDED.group_name, updated_at = now()
     RETURNING *`,
    [groupId, groupName || null]
  );
  await query(
    `INSERT INTO eris_rage (group_id, rage) VALUES ($1, 0)
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId]
  );
  await query(
    `INSERT INTO settings (group_id) VALUES ($1)
     ON CONFLICT (group_id) DO NOTHING`,
    [groupId]
  );
  return rows[0];
}

async function getGroup(groupId) {
  const { rows } = await query('SELECT * FROM groups WHERE group_id = $1', [groupId]);
  return rows[0] || null;
}

async function incrementGroupCounters(groupId, { duels = 0, xp = 0, players = 0 }) {
  await query(
    `UPDATE groups
     SET total_duels = total_duels + $2,
         total_xp = total_xp + $3,
         total_players = total_players + $4,
         updated_at = now()
     WHERE group_id = $1`,
    [groupId, duels, xp, players]
  );
}

async function getSettings(groupId) {
  const { rows } = await query('SELECT * FROM settings WHERE group_id = $1', [groupId]);
  return rows[0] || null;
}

module.exports = { upsertGroup, getGroup, incrementGroupCounters, getSettings };
