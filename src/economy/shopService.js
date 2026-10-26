'use strict';
const itemsCatalog = require('../config/items.json');
const playerStatsModel = require('../database/models/playerStatsModel');
const inventoryModel = require('../database/models/inventoryModel');
const purchaseLogModel = require('../database/models/purchaseLogModel');
const decorativeRotationModel = require('../database/models/decorativeRotationModel');
const weeklyOfferModel = require('../database/models/weeklyOfferModel');
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

/** { base, percent, final } — price after the current weekly discount (if the item has one). */
async function getPriceInfo(itemKey) {
  const def = getItemDef(itemKey);
  const base = def ? def.price : 0;
  const percent = def ? await weeklyOfferModel.getDiscountPercent(itemKey).catch(() => 0) : 0;
  const final = percent > 0 ? Math.max(1, Math.round(base * (100 - percent) / 100)) : base;
  return { base, percent, final };
}

/**
 * Everything currently on sale, in display order: this week's discounts first,
 * then regular products (consumables, cards, mystery, profile templates), then the
 * weekly decorative rotation. Each entry: { key, ...def, priceInfo }.
 */
async function listShopCatalog() {
  const offers = await weeklyOfferModel.getActiveOffers();
  const offerKeys = (offers.items || []).map((o) => o.key);
  const regular = listPurchasableItems();
  const decorative = await listDecorativeShopItems();

  const ordered = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || seen.has(item.key)) return;
    seen.add(item.key);
    ordered.push(item);
  };
  for (const key of offerKeys) push(regular.find((i) => i.key === key));
  regular.forEach(push);
  decorative.forEach(push);

  const result = [];
  for (const item of ordered) result.push({ ...item, priceInfo: await getPriceInfo(item.key) });
  return result;
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
  if (def.category === 'CARD' || def.category === 'DECORATIVE' || def.category === 'PROFILE_TEMPLATE') {
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
  const unitPrice = (await getPriceInfo(itemKey)).final;
  const totalPrice = unitPrice * quantity;
  if (stats.coins < totalPrice) {
    return { success: false, reason: 'NOT_ENOUGH_COINS', price: totalPrice };
  }

  const spendResult = await coinService.spendCoins(
    telegramId, groupId, stats, totalPrice, 'SHOP_PURCHASE', { itemKey, quantity }
  );
  if (!spendResult.success) {
    return { success: false, reason: 'NOT_ENOUGH_COINS', price: totalPrice };
  }

  let newInventoryQty;
  try {
    newInventoryQty = await inventoryModel.addItem(telegramId, groupId, itemKey, quantity, def.stackLimit);
    await purchaseLogModel.recordPurchase(telegramId, groupId, itemKey, quantity);
  } catch (err) {
    // Never keep the coins if the item couldn't be delivered: refund, then rethrow.
    await coinService.grantCoins(
      telegramId, groupId, spendResult.stats, totalPrice, 'SHOP_REFUND', { itemKey, quantity }
    ).catch((refundErr) => console.error('[shop] refund failed:', refundErr));
    throw err;
  }

  return {
    success: true,
    item: def,
    quantity,
    newInventoryQty,
    remainingCoins: spendResult.stats.coins,
    paid: totalPrice,
  };
}

module.exports = { listPurchasableItems, listDecorativeShopItems, listShopCatalog, getPriceInfo, getItemDef, buyItem };
