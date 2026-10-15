'use strict';
const topicModel = require('../database/models/topicModel');

const TTL_MS = 15 * 1000;
const cache = new Map(); // groupId -> { at, rules: Map<featureKey, Set<threadId>> }

async function loadRules(groupId) {
  const hit = cache.get(groupId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rules;

  const rows = await topicModel.getRules(groupId);
  const rules = new Map();
  for (const row of rows) {
    if (!rules.has(row.feature_key)) rules.set(row.feature_key, new Set());
    rules.get(row.feature_key).add(Number(row.thread_id));
  }
  cache.set(groupId, { at: Date.now(), rules });
  return rules;
}

function invalidate(groupId) {
  cache.delete(groupId);
}

/** A feature with no rules works everywhere; otherwise only in its listed threads. */
async function isAllowed(groupId, feature, threadId) {
  const rules = await loadRules(groupId);
  const set = rules.get(feature);
  return !set || set.size === 0 || set.has(threadId || 0);
}

async function getAllowedThreads(groupId, feature) {
  const rules = await loadRules(groupId);
  return Array.from(rules.get(feature) || []);
}

/**
 * Where bot-initiated announcements (Eris event, chest results...) should go:
 * the origin thread if it's allowed, otherwise the first allowed thread.
 */
async function resolveAnnounceThread(groupId, feature, originThread = 0) {
  const allowed = await getAllowedThreads(groupId, feature);
  if (allowed.length === 0 || allowed.includes(originThread)) return originThread;
  return allowed[0];
}

/**
 * Panel button logic:
 *  - unrestricted -> restrict to this topic
 *  - restricted & includes this topic -> remove it (no topics left = unrestricted again)
 *  - restricted & doesn't include it -> add it
 */
async function toggle(groupId, feature, threadId) {
  const rules = await loadRules(groupId);
  const set = rules.get(feature);
  if (set && set.has(threadId)) {
    await topicModel.removeRule(groupId, feature, threadId);
  } else {
    await topicModel.addRule(groupId, feature, threadId);
  }
  invalidate(groupId);
}

async function resetAll(groupId) {
  await topicModel.clearAll(groupId);
  invalidate(groupId);
}

async function getNames(groupId) {
  return topicModel.getTopicNames(groupId);
}

const nameSeen = new Map();
async function rememberTopicName(groupId, threadId, name) {
  if (!threadId || !name) return;
  const key = `${groupId}:${threadId}`;
  if (nameSeen.get(key) === name) return;
  nameSeen.set(key, name);
  await topicModel.upsertTopicName(groupId, threadId, name);
}

function labelOf(names, threadId) {
  if (!threadId) return 'عمومی (General)';
  return names.get(threadId) || `موضوع #${threadId}`;
}

module.exports = {
  loadRules, invalidate, isAllowed, getAllowedThreads, resolveAnnounceThread,
  toggle, resetAll, getNames, rememberTopicName, labelOf,
};
