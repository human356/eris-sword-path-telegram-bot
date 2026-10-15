'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');

async function getActiveEvent(groupId) {
  const { rows } = await query(
    `SELECT * FROM events WHERE group_id = $1 AND state = 'ACTIVE' ORDER BY id DESC LIMIT 1`,
    [groupId]
  );
  return rows[0] || null;
}

async function createEvent(groupId, type = 'ERIS_CHALLENGE') {
  const endsAt = new Date(Date.now() + C.ERIS_EVENT_DURATION_MINUTES * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO events (group_id, type, ends_at) VALUES ($1, $2, $3) RETURNING *`,
    [groupId, type, endsAt]
  );
  return rows[0];
}

async function setChatMessageId(eventId, messageId) {
  await query('UPDATE events SET chat_message_id = $2 WHERE id = $1', [eventId, messageId]);
}

async function setThreadId(eventId, threadId) {
  await query('UPDATE events SET thread_id = $2 WHERE id = $1', [eventId, threadId || 0]);
}

async function recordAttempt(eventId, telegramId, damage) {
  await query(
    `INSERT INTO event_participants (event_id, telegram_id, damage, attempted)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (event_id, telegram_id)
     DO UPDATE SET damage = event_participants.damage + EXCLUDED.damage, attempted = TRUE`,
    [eventId, telegramId, damage]
  );
}

async function hasAttempted(eventId, telegramId) {
  const { rows } = await query(
    'SELECT 1 FROM event_participants WHERE event_id = $1 AND telegram_id = $2 AND attempted = TRUE',
    [eventId, telegramId]
  );
  return !!rows[0];
}

async function getLeaderboard(eventId, limit = 10) {
  const { rows } = await query(
    `SELECT ep.*, u.display_name FROM event_participants ep
     JOIN users u ON u.telegram_id = ep.telegram_id
     WHERE ep.event_id = $1 ORDER BY ep.damage DESC LIMIT $2`,
    [eventId, limit]
  );
  return rows;
}

async function finishEvent(eventId, results) {
  const { rows } = await query(
    `UPDATE events SET state = 'FINISHED', results = $2 WHERE id = $1 RETURNING *`,
    [eventId, JSON.stringify(results)]
  );
  return rows[0];
}

async function getExpiredActiveEvents() {
  const { rows } = await query(
    `SELECT * FROM events WHERE state = 'ACTIVE' AND ends_at < now()`
  );
  return rows;
}

module.exports = {
  getActiveEvent, createEvent, setChatMessageId, setThreadId, recordAttempt,
  hasAttempted, getLeaderboard, finishEvent, getExpiredActiveEvents,
};
