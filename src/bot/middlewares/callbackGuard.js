'use strict';
const { query } = require('../../database/pool');

/**
 * Telegram can redeliver the same callback_query on retries; this makes sure
 * we only ever act on it once (spec §25: "Replay کردن Callback").
 */
async function callbackGuard(ctx, next) {
  if (!ctx.callbackQuery) return next();
  const id = ctx.callbackQuery.id;
  try {
    const { rows } = await query(
      `INSERT INTO processed_callbacks (callback_id) VALUES ($1)
       ON CONFLICT (callback_id) DO NOTHING RETURNING callback_id`,
      [id]
    );
    if (!rows[0]) {
      // Already processed once — acknowledge silently and stop.
      await ctx.answerCbQuery().catch(() => {});
      return;
    }
  } catch (err) {
    // If the guard itself fails, fail safe by continuing rather than blocking gameplay.
  }
  return next();
}

module.exports = callbackGuard;
