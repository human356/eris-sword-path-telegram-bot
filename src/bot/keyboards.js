'use strict';
const { Markup } = require('telegraf');
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

function moveKeyboard(battleId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        '⚔️ حمله',
        `battle:${battleId}:move:ATTACK`
      ),
      Markup.button.callback(
        '🛡 دفاع',
        `battle:${battleId}:move:GUARD`
      ),
    ],
    [
      Markup.button.callback(
        '💨 جاخالی',
        `battle:${battleId}:move:DODGE`
      ),
      Markup.button.callback(
        '🔥 حمله سنگین',
        `battle:${battleId}:move:HEAVY_ATTACK`
      ),
    ],
    [
      Markup.button.callback(
        '⚡ ضدحمله',
        `battle:${battleId}:move:COUNTER`
      )
    ],
    // Item use is a separate action from picking a move — a player can use
    // an item AND still submit a move the same round (spec §3/§8).
    [
      Markup.button.callback(
        '💊 قرص استامینا',
        `battle:${battleId}:item:STAMINA_PILL`
      ),
      Markup.button.callback(
        '🧪 معجون درمان',
        `battle:${battleId}:item:HEALING_POTION`
      ),
    ],
  ]);
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
