'use strict';
const { query, withTransaction } = require('../pool');

const STATES = Object.freeze({
  RECRUITING: 'RECRUITING',
  ACTIVE: 'ACTIVE',
  WAITING_FOR_MOVES: 'WAITING_FOR_MOVES',
  RESOLVING: 'RESOLVING',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

const TYPES = Object.freeze({ TEAM: 'TEAM', FFA: 'FFA', PVE: 'PVE' });

async function createBattle({ groupId, type, maxRounds, difficulty, initiatorId, recruitSeconds, threadId = 0 }) {
  const recruitExpiresAt = recruitSeconds ? new Date(Date.now() + recruitSeconds * 1000) : null;
  const { rows } = await query(
    `INSERT INTO multiplayer_battles (group_id, type, state, max_rounds, difficulty, initiator_id, recruit_expires_at, thread_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [groupId, type, STATES.RECRUITING, maxRounds, difficulty || null, initiatorId, recruitExpiresAt, threadId]
  );
  return rows[0];
}

async function getBattle(battleId) {
  const { rows } = await query('SELECT * FROM multiplayer_battles WHERE id = $1', [battleId]);
  return rows[0] || null;
}

async function getRecruitingBattleForGroup(groupId, type) {
  const { rows } = await query(
    `SELECT * FROM multiplayer_battles WHERE group_id = $1 AND type = $2 AND state = 'RECRUITING' ORDER BY id DESC LIMIT 1`,
    [groupId, type]
  );
  return rows[0] || null;
}

async function getActiveBattleForUser(groupId, telegramId) {
  const { rows } = await query(
    `SELECT mb.* FROM multiplayer_battles mb
     JOIN battle_participants bp ON bp.battle_id = mb.id
     WHERE mb.group_id = $1 AND bp.telegram_id = $2
       AND mb.state NOT IN ('FINISHED', 'CANCELLED', 'EXPIRED')
     ORDER BY mb.id DESC LIMIT 1`,
    [groupId, telegramId]
  );
  return rows[0] || null;
}

async function setChatMessageId(battleId, messageId) {
  await query('UPDATE multiplayer_battles SET chat_message_id = $2, updated_at = now() WHERE id = $1', [battleId, messageId]);
}

async function setState(battleId, state, extra = {}) {
  const keys = Object.keys(extra);
  const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
  const { rows } = await query(
    `UPDATE multiplayer_battles SET state = $2, updated_at = now() ${setClauses.length ? ', ' + setClauses.join(', ') : ''} WHERE id = $1 RETURNING *`,
    [battleId, state, ...keys.map((k) => extra[k])]
  );
  return rows[0] || null;
}

async function advanceRound(battleId, roundNumber, state = STATES.WAITING_FOR_MOVES) {
  const { rows } = await query(
    'UPDATE multiplayer_battles SET round_number = $2, state = $3, updated_at = now() WHERE id = $1 RETURNING *',
    [battleId, roundNumber, state]
  );
  return rows[0] || null;
}

async function addParticipant({ battleId, telegramId, isBot = false, displayName, team, hp, maxHp, stamina, maxStamina }) {
  const { rows } = await query(
    `INSERT INTO battle_participants (battle_id, telegram_id, is_bot, display_name, team, hp, max_hp, stamina, max_stamina)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [battleId, telegramId || null, isBot, displayName, team || null, hp, maxHp, stamina, maxStamina]
  );
  return rows[0];
}

async function getParticipants(battleId) {
  const { rows } = await query('SELECT * FROM battle_participants WHERE battle_id = $1 ORDER BY id', [battleId]);
  return rows;
}

async function getParticipant(battleId, telegramId) {
  const { rows } = await query(
    'SELECT * FROM battle_participants WHERE battle_id = $1 AND telegram_id = $2',
    [battleId, telegramId]
  );
  return rows[0] || null;
}

async function isAlreadyJoined(battleId, telegramId) {
  return !!(await getParticipant(battleId, telegramId));
}

/** Bulk-updates a set of participants inside one transaction. `updates` = [{ id, patch }]. */
async function updateParticipants(updates) {
  await withTransaction(async (client) => {
    for (const { id, patch } of updates) {
      const keys = Object.keys(patch);
      if (keys.length === 0) continue;
      const setClauses = keys.map((k, i) => (k === 'active_effects' ? `${k} = $${i + 2}::jsonb` : `${k} = $${i + 2}`));
      const values = keys.map((k) => (k === 'active_effects' ? JSON.stringify(patch[k]) : patch[k]));
      await client.query(`UPDATE battle_participants SET ${setClauses.join(', ')} WHERE id = $1`, [id, ...values]);
    }
  });
}

async function expireStaleRecruiting() {
  const { rows } = await query(
    `UPDATE multiplayer_battles SET state = 'EXPIRED', updated_at = now()
     WHERE state = 'RECRUITING' AND recruit_expires_at IS NOT NULL AND recruit_expires_at < now()
     RETURNING *`
  );
  return rows;
}

module.exports = {
  STATES, TYPES,
  createBattle, getBattle, getRecruitingBattleForGroup, getActiveBattleForUser,
  setChatMessageId, setState, advanceRound,
  addParticipant, getParticipants, getParticipant, isAlreadyJoined, updateParticipants,
  expireStaleRecruiting,
};
