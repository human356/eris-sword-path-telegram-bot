'use strict';
const { query } = require('../pool');

async function getSettings(groupId) {
  const { rows } = await query('SELECT * FROM group_shop_settings WHERE group_id = $1', [groupId]);
  return rows[0] || { group_id: groupId, enabled: false, thread_id: 0, last_post_key: null, last_posted_at: null };
}

async function setEnabled(groupId, enabled) {
  const { rows } = await query(
    `INSERT INTO group_shop_settings (group_id, enabled, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (group_id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
     RETURNING *`,
    [groupId, enabled]
  );
  return rows[0];
}

async function setThread(groupId, threadId) {
  const { rows } = await query(
    `INSERT INTO group_shop_settings (group_id, thread_id, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (group_id) DO UPDATE SET thread_id = EXCLUDED.thread_id, updated_at = now()
     RETURNING *`,
    [groupId, threadId || 0]
  );
  return rows[0];
}

async function markPosted(groupId, postKey) {
  await query(
    `INSERT INTO group_shop_settings (group_id, last_post_key, last_posted_at, updated_at) VALUES ($1, $2, now(), now())
     ON CONFLICT (group_id) DO UPDATE SET last_post_key = EXCLUDED.last_post_key, last_posted_at = now(), updated_at = now()`,
    [groupId, postKey]
  );
}

/** Groups that want the weekly post and haven't received this week's yet. */
async function listDueGroups(postKey) {
  const { rows } = await query(
    `SELECT * FROM group_shop_settings
     WHERE enabled = TRUE AND (last_post_key IS NULL OR last_post_key <> $1)`,
    [postKey]
  );
  return rows;
}

module.exports = { getSettings, setEnabled, setThread, markPosted, listDueGroups };
