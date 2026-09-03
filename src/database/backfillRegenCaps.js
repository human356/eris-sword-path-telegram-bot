'use strict';
const { pool } = require('./pool');
const { maxHpForLevel, maxStaminaForLevel } = require('../utils/formulas');

/**
 * Recalculates max_hp/max_stamina for every player based on their current
 * level (Phase 3's level-scaling formulas), topping up current hp/stamina
 * by the same amount the cap grew. Idempotent — running it again later (or
 * every time the bot boots) is a safe no-op for anyone whose cap is already
 * correct, since the delta is computed fresh each time and only ever grows,
 * never shrinks, a player's stats.
 */
async function runRegenCapsBackfill() {
  const { rows } = await pool.query(
    'SELECT id, level, hp, max_hp, stamina, max_stamina FROM player_group_stats'
  );

  let changed = 0;
  for (const row of rows) {
    const newMaxHp = maxHpForLevel(row.level);
    const newMaxStamina = maxStaminaForLevel(row.level);
    const hpCapGain = Math.max(0, newMaxHp - row.max_hp);
    const staminaCapGain = Math.max(0, newMaxStamina - row.max_stamina);

    if (hpCapGain === 0 && staminaCapGain === 0) continue; // already correct — skip the write

    const newHp = Math.min(newMaxHp, row.hp + hpCapGain);
    const newStamina = Math.min(newMaxStamina, row.stamina + staminaCapGain);

    await pool.query(
      `UPDATE player_group_stats SET max_hp = $2, max_stamina = $3, hp = $4, stamina = $5 WHERE id = $1`,
      [row.id, newMaxHp, newMaxStamina, newHp, newStamina]
    );
    changed += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`[backfill] regen caps checked for ${rows.length} player(s), ${changed} updated.`);
}

// Still usable directly from a terminal for anyone who has shell access —
// only exits the process in that case.
if (require.main === module) {
  runRegenCapsBackfill()
    .then(() => pool.end())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[backfill] failed:', err);
      process.exit(1);
    });
}

module.exports = { runRegenCapsBackfill };
