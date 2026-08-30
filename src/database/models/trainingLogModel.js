'use strict';
const { query } = require('../pool');

async function recordTraining({ telegramId, groupId, trainingType, statGained }) {
  await query(
    `INSERT INTO training_logs (telegram_id, group_id, training_type, stat_gained)
     VALUES ($1, $2, $3, $4)`,
    [telegramId, groupId, trainingType, statGained || null]
  );
}

module.exports = { recordTraining };
