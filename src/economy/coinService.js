'use strict';
const playerStatsModel = require('../database/models/playerStatsModel');
const transactionModel = require('../database/models/transactionModel');

async function grantCoins(telegramId, groupId, stats, amount, type, metadata = {}) {
  const updated = await playerStatsModel.updatePlayerStats(telegramId, groupId, {
    coins: stats.coins + amount,
  });
  await transactionModel.recordTransaction({
    telegramId, groupId, type, coinsDelta: amount, metadata,
  });
  return updated;
}

async function spendCoins(telegramId, groupId, stats, amount, type, metadata = {}) {
  if (stats.coins < amount) {
    return { success: false, stats };
  }
  const updated = await playerStatsModel.updatePlayerStats(telegramId, groupId, {
    coins: stats.coins - amount,
  });
  await transactionModel.recordTransaction({
    telegramId, groupId, type, coinsDelta: -amount, metadata,
  });
  return { success: true, stats: updated };
}

module.exports = { grantCoins, spendCoins };
