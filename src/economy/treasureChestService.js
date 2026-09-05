'use strict';
const C = require('../config/constants');
const itemsCatalog = require('../config/items.json');
const inventoryModel = require('../database/models/inventoryModel');
const playerStatsModel = require('../database/models/playerStatsModel');
const xpService = require('../ranking/xpService');
const coinService = require('../economy/coinService');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(table) {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of table) {
    if (roll < entry.weight) return entry;
    roll -= entry.weight;
  }
  return table[table.length - 1];
}

function randomKeyOfCategory(category) {
  const keys = Object.keys(itemsCatalog).filter((k) => itemsCatalog[k].category === category);
  if (keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Rolls C.TREASURE_CHEST_ROLL_COUNT independent rewards from
 * C.TREASURE_CHEST_LOOT_TABLE and applies all of them, returning the final
 * updated stats plus a list of reward summary lines for the report.
 *
 * CARD/DECORATIVE rolls that would go to waste (player already owns it —
 * both categories are stack-limited to 1) fall back to a coin+XP
 * consolation instead of being wasted (spec §6.1: "جایگزین با پاداش
 * سکه/XP می‌شود تا هدر نرود" — applied to decorative rolls too, for the
 * same reason, even though the spec only named cards explicitly).
 *
 * Returns { success, reason? } on failure, or
 * { success: true, rewardLines, stats, totalCoins, totalXp } on success.
 */
async function openChest(telegramId, groupId) {
  const owned = await inventoryModel.getItemQuantity(telegramId, groupId, 'TREASURE_CHEST');
  if (owned <= 0) return { success: false, reason: 'NO_CHEST' };

  await inventoryModel.removeItem(telegramId, groupId, 'TREASURE_CHEST', 1);

  let stats = (await playerStatsModel.getOrCreatePlayerStats(telegramId, groupId)).stats;
  const rewardLines = [];
  let totalCoins = 0;
  let totalXp = 0;

  for (let i = 0; i < C.TREASURE_CHEST_ROLL_COUNT; i += 1) {
    const roll = pickWeighted(C.TREASURE_CHEST_LOOT_TABLE);

    if (roll.type === 'COINS') {
      const amount = randInt(roll.min, roll.max);
      totalCoins += amount;
      rewardLines.push(`🪙 ${amount} سکه`);
    } else if (roll.type === 'XP') {
      const amount = randInt(roll.min, roll.max);
      totalXp += amount;
      rewardLines.push(`⭐ ${amount} XP`);
    } else if (roll.type === 'CONSUMABLE_ITEM') {
      const key = randomKeyOfCategory('CONSUMABLE');
      if (!key) {
        totalCoins += C.TREASURE_CHEST_FALLBACK_COINS;
        rewardLines.push(`🪙 ${C.TREASURE_CHEST_FALLBACK_COINS} سکه`);
        continue;
      }
      const def = itemsCatalog[key];
      await inventoryModel.addItem(telegramId, groupId, key, 1, def.stackLimit);
      rewardLines.push(`${def.emoji || '📦'} ۱ عدد ${def.label}`);
    } else if (roll.type === 'DECORATIVE_ITEM' || roll.type === 'CARD_ITEM') {
      const category = roll.type === 'DECORATIVE_ITEM' ? 'DECORATIVE' : 'CARD';
      const key = randomKeyOfCategory(category);
      const def = key ? itemsCatalog[key] : null;
      const alreadyOwned = key ? await inventoryModel.getItemQuantity(telegramId, groupId, key) : 0;

      if (!key || alreadyOwned >= (def.stackLimit || 1)) {
        totalCoins += C.TREASURE_CHEST_FALLBACK_COINS;
        totalXp += C.TREASURE_CHEST_FALLBACK_XP;
        rewardLines.push(
          `🪙 ${C.TREASURE_CHEST_FALLBACK_COINS} سکه + ⭐ ${C.TREASURE_CHEST_FALLBACK_XP} XP (چون این مورد را از قبل داشتید)`
        );
      } else {
        await inventoryModel.addItem(telegramId, groupId, key, 1, def.stackLimit);
        const tag = category === 'CARD' ? '🃏 کارت نبرد' : '🎨 تزئینی';
        rewardLines.push(`${def.emoji || '📦'} ${tag}: ${def.label}`);
      }
    }
  }

  if (totalCoins > 0) {
    stats = await coinService.grantCoins(telegramId, groupId, stats, totalCoins, 'TREASURE_CHEST');
  }
  if (totalXp > 0) {
    const xpResult = await xpService.grantXp(telegramId, groupId, stats, totalXp);
    stats = xpResult.stats;
  }

  return { success: true, rewardLines, stats, totalCoins, totalXp };
}

module.exports = { openChest };
