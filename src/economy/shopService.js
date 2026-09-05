'use strict';
const itemsCatalog = require('../config/items.json');
const playerStatsModel = require('../database/models/playerStatsModel');
const inventoryModel = require('../database/models/inventoryModel');
const purchaseLogModel = require('../database/models/purchaseLogModel');
const decorativeRotationModel = require('../database/models/decorativeRotationModel');
const coinService = require('./coinService');

function getItemDef(itemKey) {
  return itemsCatalog[itemKey] || null;
}

/**
 * All purchasable items EXCEPT decorative ones. DECORATIVE items rotate
 * weekly and require a DB read to resolve, so they're fetched separately
 * via listDecorativeShopItems() (Phase 6).
 */
function listPurchasableItems() {
  return Object.entries(itemsCatalog)
    .filter(([, def]) => def.purchasable && def.category !== 'DECORATIVE')
    .map(([key, def]) => ({ key, ...def }));
}

/** The DECORATIVE items currently in the weekly shop rotation, shop-ready. */
async function listDecorativeShopItems() {
  const rotation = await decorativeRotationModel.getActiveRotation();
  const keys = rotation.item_keys || [];
  return keys
    .map((key) => (itemsCatalog[key] ? { key, ...itemsCatalog[key] } : null))
    .filter(Boolean);
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

  // Decorative items can only be bought while they're in the active weekly
  // rotation — this stops someone buying a stale key from an old /shop
  // keyboard after the rotation has already moved on (Phase 6).
  if (def.category === 'DECORATIVE') {
    const rotation = await decorativeRotationModel.getActiveRotation();
    if (!(rotation.item_keys || []).includes(itemKey)) {
      return { success: false, reason: 'NOT_IN_ROTATION' };
    }
  }

  // Battle cards (Phase 4) and decorative collectibles (Phase 6) are
  // one-time unlocks (stackLimit 1) — buying one you already own would
  // otherwise just silently waste coins.
  if (def.category === 'CARD' || def.category === 'DECORATIVE') {
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

module.exports = { listPurchasableItems, listDecorativeShopItems, getItemDef, buyItem };
