'use strict';
const { query } = require('../database/pool');
const C = require('../config/constants');

/**
 * One regen tick for EVERY player: +1% of max stamina and +1% of max HP
 * (at least 1 point), capped at the max. Called by a cron in index.js every
 * C.REGEN_TICK_MINUTES minutes — regen no longer depends on anyone opening
 * /profile (which used to refill everything at once).
 */
async function runRegenTick() {
  const { rowCount } = await query(
    `UPDATE player_group_stats
     SET stamina = LEAST(max_stamina, stamina + GREATEST(1, CEIL(max_stamina * $1::numeric))::int),
         hp      = LEAST(max_hp,      hp      + GREATEST(1, CEIL(max_hp * $2::numeric))::int)
     WHERE stamina < max_stamina OR hp < max_hp`,
    [C.STAMINA_REGEN_PERCENT_PER_TICK, C.HP_REGEN_PERCENT_PER_TICK]
  );
  return rowCount;
}

module.exports = { runRegenTick };
