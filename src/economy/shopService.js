'use strict';
const itemsCatalog = require('../config/items.json');
const playerStatsModel = require('../database/models/playerStatsModel');
const inventoryModel = require('../database/models/inventoryModel');
const purchaseLogModel = require('../database/models/purchaseLogModel');
const coinService = require('./coinService');

function listPurchasableItems() {
  return Object.entries(itemsCatalog)
    .filter(([, def]) => def.purchasable)
    .map(([key, def]) => ({ key, ...def }));
}

function getItemDef(itemKey) {
  return itemsCatalog[itemKey] || null;
}

/**
 * Buys `quantity` of `itemKey` for a player in a group.
 * Returns { success, reason? , item?, quantity?, newInventoryQty?, remainingCoins? }.
 */
async function buyItem(telegramId, groupId, itemKey, quantity = 1) {
  const def = getItemDef(itemKey);
  if (!def || !def.purchasable) return { success: false, reason: 'INVALID_ITEM' };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, reason: 'INVALID_QUANTITY' };
  }

  // Battle cards (Phase 4) are one-time unlocks (stackLimit 1) — buying one
  // you already own would otherwise just silently waste coins.
  if (def.category === 'CARD') {
    const owned = await inventoryModel.getItemQuantity(telegramId, groupId, itemKey);
    if (owned >= (def.stackLimit || 1)) {
      return { success: false, reason: 'ALREADY_OWNED' };
    }
  }

  if (def.dailyLimit) {
    const boughtToday = await purchaseLogModel.getTodayPurchasedQty(telegramId, groupId, itemKey);
    if (boughtToday + quantity > def.dailyLimit) {
      return { success: false, reason: 'DAILY_LIMIT', remaining: Math.max(0, def.dailyLimit - boughtToday) };
    }
  }

  const stats = (await playerStatsModel.getOrCreatePlayerStats(telegramId, groupId)).stats;
  const totalPrice = def.price * quantity;
  if (stats.coins < totalPrice) {
    return { success: false, reason: 'NOT_ENOUGH_COINS', price: totalPrice };
  }

  const spendResult = await coinService.spendCoins(
    telegramId, groupId, stats, totalPrice, 'SHOP_PURCHASE', { itemKey, quantity }
  );
  if (!spendResult.success) {
    return { success: false, reason: 'NOT_ENOUGH_COINS', price: totalPrice };
  }

  const newInventoryQty = await inventoryModel.addItem(telegramId, groupId, itemKey, quantity, def.stackLimit);
  await purchaseLogModel.recordPurchase(telegramId, groupId, itemKey, quantity);

  return {
    success: true,
    item: def,
    quantity,
    newInventoryQty,
    remainingCoins: spendResult.stats.coins,
  };
}

module.exports = { listPurchasableItems, getItemDef, buyItem };
