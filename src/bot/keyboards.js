'use strict';
const { Markup } = require('telegraf');
const { getCardLabel } = require('../utils/cardLabels');
const itemsCatalog = require('../config/items.json');

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚔️ مبارزه', 'menu:fight'),
      Markup.button.callback('🏋️ تمرین', 'menu:training')
    ],
    [
      Markup.button.callback('👤 پروفایل', 'menu:profile'),
      Markup.button.callback('🏆 رتبه‌بندی', 'menu:ranking')
    ],
    [
      Markup.button.callback('🎭 شخصیت', 'menu:character'),
    ],
    [
      Markup.button.callback('🎯 روزانه', 'menu:daily'),
      Markup.button.callback('🔥 خشم اریس', 'menu:rage')
    ],
    [
      Markup.button.callback('🛒 فروشگاه', 'menu:shop'),
      Markup.button.callback('🎒 جیب من', 'menu:inventory')
    ],
  ]);
}

function challengeKeyboard(battleId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚔️ قبول کردن', `battle:${battleId}:accept`),
      Markup.button.callback('❌ رد کردن', `battle:${battleId}:decline`),
    ],
  ]);
}

/**
 * `cardKeys`: union of the two duelists' 5-slot loadouts (Phase 2). Every
 * card either of them has equipped gets a button — pressing one that isn't
 * in YOUR OWN loadout is rejected by battleManager.submitMove with a clear
 * error, since a single Telegram message can't show two different keyboards
 * to two different people.
 */
function moveKeyboard(battleId, cardKeys) {
  const moveRows = [];
  for (let i = 0; i < cardKeys.length; i += 2) {
    const row = [
      Markup.button.callback(getCardLabel(cardKeys[i]), `battle:${battleId}:move:${cardKeys[i]}`),
    ];
    if (cardKeys[i + 1]) {
      row.push(Markup.button.callback(getCardLabel(cardKeys[i + 1]), `battle:${battleId}:move:${cardKeys[i + 1]}`));
    }
    moveRows.push(row);
  }

  // Item use is a separate action from picking a move — a player can use an
  // item AND still submit a move the same round (spec §3/§8). Built from the
  // catalog directly so newly added in-battle items automatically show up.
  const itemRows = [];
  const usableItemKeys = Object.keys(itemsCatalog).filter((key) => itemsCatalog[key].usableInBattle);
  for (let i = 0; i < usableItemKeys.length; i += 2) {
    const defA = itemsCatalog[usableItemKeys[i]];
    const row = [Markup.button.callback(`${defA.emoji || '📦'} ${defA.label}`, `battle:${battleId}:item:${usableItemKeys[i]}`)];
    if (usableItemKeys[i + 1]) {
      const defB = itemsCatalog[usableItemKeys[i + 1]];
      row.push(Markup.button.callback(`${defB.emoji || '📦'} ${defB.label}`, `battle:${battleId}:item:${usableItemKeys[i + 1]}`));
    }
    itemRows.push(row);
  }

  return Markup.inlineKeyboard([...moveRows, ...itemRows]);
}

function trainingKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '⚔️ قدرت',
        'training:STRENGTH'
      ),
      Markup.button.callback(
        '💨 سرعت',
        'training:SPEED'
      ),
    ],
    [
      Markup.button.callback(
        '🛡 دفاع',
        'training:DEFENSE'
      ),
      Markup.button.callback(
        '🎯 دقت',
        'training:ACCURACY'
      ),
    ],
  ]);
}

function erisEventKeyboard(eventId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '⚔️ حمله به اریس',
        `event:${eventId}:attack`
      )
    ]
  ]);
}

/** items: [{ key, label, emoji, price }] — one buy button per row, plus a shortcut to جیب من. */
function shopKeyboard(items) {
  const rows = items.map((item) => [
    Markup.button.callback(
      `${item.emoji || '📦'} ${item.label} — ${item.price}🪙`,
      `shop:buy:${item.key}`
    ),
  ]);
  rows.push([Markup.button.callback('🎒 جیب من', 'menu:inventory')]);
  return Markup.inlineKeyboard(rows);
}

module.exports = {
  mainMenu, challengeKeyboard, moveKeyboard, trainingKeyboard, erisEventKeyboard, shopKeyboard,
};
