'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');

const STATES = Object.freeze({
  WAITING_FOR_ACCEPT: 'WAITING_FOR_ACCEPT',
  ACTIVE: 'ACTIVE',
  WAITING_FOR_MOVES: 'WAITING_FOR_MOVES',
  RESOLVING: 'RESOLVING',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const LIVE_STAT_COLUMNS = new Set([
  'challenger_hp', 'challenger_stamina', 'opponent_hp', 'opponent_stamina',
]);

async function createBattle({ groupId, challengerId, opponentId, challengerStats, opponentStats }) {
  const expiresAt = new Date(Date.now() + C.CHALLENGE_TIMEOUT_SECONDS * 1000);
  const { rows } = await query(
    `INSERT INTO battles
      (group_id, challenger_id, opponent_id, state,
       challenger_hp, challenger_stamina, opponent_hp, opponent_stamina, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      groupId, challengerId, opponentId, STATES.WAITING_FOR_ACCEPT,
      challengerStats.hp, challengerStats.stamina, opponentStats.hp, opponentStats.stamina,
      expiresAt,
    ]
  );
  return rows[0];
}

async function getBattle(battleId) {
  const { rows } = await query('SELECT * FROM battles WHERE id = $1', [battleId]);
  return rows[0] || null;
}

async function getActiveBattleForUser(groupId, telegramId) {
  const { rows } = await query(
    `SELECT * FROM battles
     WHERE group_id = $1 AND (challenger_id = $2 OR opponent_id = $2)
       AND state NOT IN ('FINISHED', 'CANCELLED', 'EXPIRED')
     ORDER BY id DESC LIMIT 1`,
    [groupId, telegramId]
  );
  return rows[0] || null;
}

async function setChatMessageId(battleId, messageId) {
  await query('UPDATE battles SET chat_message_id = $2, updated_at = now() WHERE id = $1', [
    battleId,
    messageId,
  ]);
}

async function transitionState(battleId, fromStates, toState, extraSet = {}, extraValues = []) {
  const extraKeys = Object.keys(extraSet);
  const extraStartIndex = 3 + fromStates.length; // $1=battleId, $2=toState, then N fromStates placeholders
  const setClauses = extraKeys.map((k, i) => `${k} = $${extraStartIndex + i}`);
  const placeholderStates = fromStates.map((_, i) => `$${i + 3}`).join(', ');

  const sql = `
    UPDATE battles
    SET state = $2, updated_at = now() ${setClauses.length ? ', ' + setClauses.join(', ') : ''}
    WHERE id = $1 AND state IN (${placeholderStates})
    RETURNING *`;

  const { rows } = await query(sql, [battleId, toState, ...fromStates, ...extraValues]);
  return rows[0] || null; // null means the transition was rejected (already left that state)
}

async function updateRoundState(battleId, {
  roundNumber, challengerHp, challengerStamina, opponentHp, opponentStamina,
  challengerAfkStreak, opponentAfkStreak, state,
}) {
  const { rows } = await query(
    `UPDATE battles
     SET round_number = $2, challenger_hp = $3, challenger_stamina = $4,
         opponent_hp = $5, opponent_stamina = $6,
         challenger_afk_streak = $7, opponent_afk_streak = $8,
         state = $9, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [battleId, roundNumber, challengerHp, challengerStamina, opponentHp, opponentStamina,
      challengerAfkStreak, opponentAfkStreak, state]
  );
  return rows[0] || null;
}

/**
 * Applies a live HP/stamina delta mid-round (e.g. a player used an item
 * before submitting their move) WITHOUT touching round_number/state/afk
 * streaks. `patch` keys must be a subset of challenger_hp/challenger_stamina/
 * opponent_hp/opponent_stamina.
 */
async function updateLiveStats(battleId, patch) {
  const entries = Object.entries(patch).filter(([k]) => LIVE_STAT_COLUMNS.has(k));
  if (entries.length === 0) return getBattle(battleId);

  const setClauses = entries.map(([k], i) => `${k} = $${i + 2}`);
  const values = entries.map(([, v]) => v);

  const { rows } = await query(
    `UPDATE battles SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`,
    [battleId, ...values]
  );
  return rows[0] || null;
}

async function finishBattle(battleId, winnerId) {
  const { rows } = await query(
    `UPDATE battles SET state = $2, winner_id = $3, updated_at = now()
     WHERE id = $1 AND state NOT IN ('FINISHED', 'CANCELLED', 'EXPIRED')
     RETURNING *`,
    [battleId, STATES.FINISHED, winnerId]
  );
  return rows[0] || null;
}

async function expireStaleBattles() {
  const { rows } = await query(
    `UPDATE battles SET state = $1, updated_at = now()
     WHERE state = 'WAITING_FOR_ACCEPT' AND expires_at < now()
     RETURNING *`,
    [STATES.EXPIRED]
  );
  return rows;
}

async function recordRound(battleId, roundNumber, data) {
  await query(
    `INSERT INTO battle_rounds
      (battle_id, round_number, challenger_move, opponent_move,
       challenger_damage_dealt, opponent_damage_dealt, log)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (battle_id, round_number) DO UPDATE
     SET challenger_move = EXCLUDED.challenger_move,
         opponent_move = EXCLUDED.opponent_move,
         challenger_damage_dealt = EXCLUDED.challenger_damage_dealt,
         opponent_damage_dealt = EXCLUDED.opponent_damage_dealt,
         log = EXCLUDED.log`,
    [
      battleId, roundNumber, data.challengerMove || null, data.opponentMove || null,
      data.challengerDamageDealt || 0, data.opponentDamageDealt || 0,
      JSON.stringify(data.log || []),
    ]
  );
}

module.exports = {
  STATES,
  createBattle,
  getBattle,
  getActiveBattleForUser,
  setChatMessageId,
  transitionState,
  updateRoundState,
  updateLiveStats,
  finishBattle,
  expireStaleBattles,
  recordRound,
};
