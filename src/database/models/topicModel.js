'use strict';
const { query } = require('../pool');

async function getRules(groupId) {
  const { rows } = await query(
    'SELECT feature_key, thread_id FROM group_topic_rules WHERE group_id = $1',
    [groupId]
  );
  return rows;
}

async function addRule(groupId, featureKey, threadId) {
  await query(
    `INSERT INTO group_topic_rules (group_id, feature_key, thread_id)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [groupId, featureKey, threadId]
  );
}

async function removeRule(groupId, featureKey, threadId) {
  await query(
    'DELETE FROM group_topic_rules WHERE group_id = $1 AND feature_key = $2 AND thread_id = $3',
    [groupId, featureKey, threadId]
  );
}

async function clearAll(groupId) {
  await query('DELETE FROM group_topic_rules WHERE group_id = $1', [groupId]);
}

async function upsertTopicName(groupId, threadId, name) {
  await query(
    `INSERT INTO group_topics (group_id, thread_id, name) VALUES ($1, $2, $3)
     ON CONFLICT (group_id, thread_id) DO UPDATE SET name = EXCLUDED.name, updated_at = now()`,
    [groupId, threadId, name]
  );
}

async function getTopicNames(groupId) {
  const { rows } = await query('SELECT thread_id, name FROM group_topics WHERE group_id = $1', [groupId]);
  return new Map(rows.map((r) => [Number(r.thread_id), r.name]));
}

module.exports = { getRules, addRule, removeRule, clearAll, upsertTopicName, getTopicNames };
