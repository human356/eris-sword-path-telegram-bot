'use strict';
const { pool } = require('./pool');
const { maxHpForLevel, maxStaminaForLevel } = require('../utils/formulas');

async function backfillRegenCaps() {
  const { rows } = await pool.query(
    'SELECT id, level, hp, max_hp, stamina, max_stamina FROM player_group_stats'
  );

  // eslint-disable-next-line no-console
  console.log(`[backfill] recalculating regen caps for ${rows.length} player(s)...`);

  for (const row of rows) {
    const newMaxHp = maxHpForLevel(row.level);
    const newMaxStamina = maxStaminaForLevel(row.level);
    const hpCapGain = Math.max(0, newMaxHp - row.max_hp);
    const staminaCapGain = Math.max(0, newMaxStamina - row.max_stamina);
    const newHp = Math.min(newMaxHp, row.hp + hpCapGain);
    const newStamina = Math.min(newMaxStamina, row.stamina + staminaCapGain);

    await pool.query(
      `UPDATE player_group_stats SET max_hp = $2, max_stamina = $3, hp = $4, stamina = $5 WHERE id = $1`,
      [row.id, newMaxHp, newMaxStamina, newHp, newStamina]
    );
  }

  // eslint-disable-next-line no-console
  console.log('[backfill] done.');
  await pool.end();
}

backfillRegenCaps().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[backfill] failed:', err);
  process.exit(1);
});
