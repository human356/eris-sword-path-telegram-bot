'use strict';
const { Markup } = require('telegraf');

function mainMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚔️ Fight', 'menu:fight'), Markup.button.callback('🏋️ Training', 'menu:training')],
    [Markup.button.callback('👤 Profile', 'menu:profile'), Markup.button.callback('🏆 Ranking', 'menu:ranking')],
    [Markup.button.callback('🎯 Daily', 'menu:daily'), Markup.button.callback('🔥 Eris Rage', 'menu:rage')],
  ]);
}

function challengeKeyboard(battleId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚔️ ACCEPT', `battle:${battleId}:accept`),
      Markup.button.callback('❌ DECLINE', `battle:${battleId}:decline`),
    ],
  ]);
}

function moveKeyboard(battleId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚔️ Attack', `battle:${battleId}:move:ATTACK`),
      Markup.button.callback('🛡 Guard', `battle:${battleId}:move:GUARD`),
    ],
    [
      Markup.button.callback('💨 Dodge', `battle:${battleId}:move:DODGE`),
      Markup.button.callback('🔥 Heavy', `battle:${battleId}:move:HEAVY_ATTACK`),
    ],
    [Markup.button.callback('⚡ Counter', `battle:${battleId}:move:COUNTER`)],
  ]);
}

function trainingKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚔️ Strength', 'training:STRENGTH'),
      Markup.button.callback('💨 Speed', 'training:SPEED'),
    ],
    [
      Markup.button.callback('🛡 Defense', 'training:DEFENSE'),
      Markup.button.callback('🎯 Accuracy', 'training:ACCURACY'),
    ],
  ]);
}

function erisEventKeyboard(eventId) {
  return Markup.inlineKeyboard([[Markup.button.callback('⚔️ Attack Eris', `event:${eventId}:attack`)]]);
}

module.exports = { mainMenu, challengeKeyboard, moveKeyboard, trainingKeyboard, erisEventKeyboard };
