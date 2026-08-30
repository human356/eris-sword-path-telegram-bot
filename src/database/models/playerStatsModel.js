'use strict';
const { query } = require('../pool');
const C = require('../../config/constants');

/**
 * Fetch a player's stats in a specific group, creating a fresh row (with base
 * stats from constants.js) if they've never played in this group before.
 * Returns { stats, created }.
 */
async function getOrCreatePlayerStats(telegramId, groupId) {
  const existing = await query(
    'SELECT * FROM player_group_stats WHERE telegram_id = $1 AND group_id = $2',
    [telegramId, groupId]
  );
  if (existing.rows[0]) {
    return { stats: existing.rows[0], created: false };
  }

  const { rows } = await query(
    `INSERT INTO player_group_stats
      (telegram_id, group_id, level, xp, coins, hp, max_hp, stamina, max_stamina,
       attack, defense, speed, crit_chance, rating, sword_rank)
     VALUES ($1, $2, $3, 0, $4, $5, $5, $6, $6, $7, $8, $9, $10, $11, 'BEGINNER')
     ON CONFLICT (telegram_id, group_id) DO UPDATE SET last_activity_at = now()
     RETURNING *`,
    [
      telegramId,
      groupId,
      C.BASE_LEVEL,
      C.BASE_COINS,
      C.BASE_HP,
      C.BASE_STAMINA,
      C.BASE_ATTACK,
      C.BASE_DEFENSE,
      C.BASE_SPEED,
      C.BASE_CRIT_CHANCE,
      C.RATING_STARTING,
    ]
  );
  return { stats: rows[0], created: true };
}

async function getPlayerStats(telegramId, groupId) {
  const { rows } = await query(
    'SELECT * FROM player_group_stats WHERE telegram_id = $1 AND group_id = $2',
    [telegramId, groupId]
  );
  return rows[0] || null;
}

async function getPlayerStatsById(id) {
  const { rows } = await query('SELECT * FROM player_group_stats WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Generic partial update. `patch` is a shallow map of column -> new value.
 * Only whitelisted columns are ever accepted, to avoid building dynamic SQL
 * from anything client-controlled.
 */
const UPDATABLE_COLUMNS = new Set([
  'level', 'xp', 'coins', 'hp', 'max_hp', 'stamina', 'max_stamina',
  'attack', 'defense', 'speed', 'crit_chance',
  'wins', 'losses', 'draws', 'rating', 'sword_rank',
  'eris_respect', 'total_fights', 'total_training',
  'current_streak', 'best_streak', 'has_won_eris_challenge',
  'last_stamina_regen_at', 'last_hp_regen_at', 'last_activity_at',
]);

async function updatePlayerStats(telegramId, groupId, patch) {
  const entries = Object.entries(patch).filter(([k]) => UPDATABLE_COLUMNS.has(k));
  if (entries.length === 0) return getPlayerStats(telegramId, groupId);

  const setClauses = entries.map(([k], i) => `${k} = $${i + 3}`);
  const values = entries.map(([, v]) => v);

  const { rows } = await query(
    `UPDATE player_group_stats
     SET ${setClauses.join(', ')}, last_activity_at = now()
     WHERE telegram_id = $1 AND group_id = $2
     RETURNING *`,
    [telegramId, groupId, ...values]
  );
  return rows[0] || null;
}

async function getGroupLeaderboard(groupId, limit = C.LEADERBOARD_PAGE_SIZE) {
  const { rows } = await query(
    `SELECT pgs.*, u.display_name, u.username
     FROM player_group_stats pgs
     JOIN users u ON u.telegram_id = pgs.telegram_id
     WHERE pgs.group_id = $1
     ORDER BY pgs.rating DESC, pgs.level DESC, pgs.wins DESC
     LIMIT $2`,
    [groupId, limit]
  );
  return rows;
}

async function getGlobalLeaderboard(limit = C.LEADERBOARD_PAGE_SIZE) {
  const { rows } = await query(
    `SELECT pgs.*, u.display_name, u.username
     FROM player_group_stats pgs
     JOIN users u ON u.telegram_id = pgs.telegram_id
     ORDER BY pgs.rating DESC, pgs.level DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  getOrCreatePlayerStats,
  getPlayerStats,
  getPlayerStatsById,
  updatePlayerStats,
  getGroupLeaderboard,
  getGlobalLeaderboard,
};
