'use strict';
const { Markup } = require('telegraf');
const { getCardLabel } = require('../utils/cardLabels');

function lobbyKeyboard(battleId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ پیوستن', `mp:${battleId}:join`)],
    [Markup.button.callback('▶️ شروع همین الان', `mp:${battleId}:start`)],
  ]);
}

function difficultyKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🟢 آسان', 'pve:start:EASY')],
    [Markup.button.callback('🟡 متوسط', 'pve:start:MEDIUM')],
    [Markup.button.callback('🔴 سخت', 'pve:start:HARD')],
  ]);
}

const SELF_ONLY_ITEMS = ['STAMINA_PILL', 'HEALING_POTION', 'ERIS_RICE'];

/** No target needed — used for PVE (vs bot) and TEAM (vs that round's champion). */
function oneVsOneMoveKeyboard(battleId, cardKeys) {
  const rows = [];
  for (let i = 0; i < cardKeys.length; i += 2) {
    const row = [Markup.button.callback(getCardLabel(cardKeys[i]), `mp:${battleId}:move:${cardKeys[i]}`)];
    if (cardKeys[i + 1]) row.push(Markup.button.callback(getCardLabel(cardKeys[i + 1]), `mp:${battleId}:move:${cardKeys[i + 1]}`));
    rows.push(row);
  }
  for (let i = 0; i < SELF_ONLY_ITEMS.length; i += 2) {
    const row = [Markup.button.callback(`🎒 ${getCardLabel(SELF_ONLY_ITEMS[i])}`, `mp:${battleId}:item:${SELF_ONLY_ITEMS[i]}`)];
    if (SELF_ONLY_ITEMS[i + 1]) row.push(Markup.button.callback(`🎒 ${getCardLabel(SELF_ONLY_ITEMS[i + 1])}`, `mp:${battleId}:item:${SELF_ONLY_ITEMS[i + 1]}`));
    rows.push(row);
  }
  return Markup.inlineKeyboard(rows);
}

const NO_TARGET_MOVES = new Set(['GUARD', 'DODGE', 'COUNTER', 'ICE_SHIELD', 'SYLPHY_HEAL', 'SWORD_PARRY']);

/**
 * FFA needs a target per offensive move — one button per (move, target) pair.
 * `alivePlayers` includes everyone still alive, EVEN the presser themself —
 * Telegram can't show a different keyboard to each viewer of one shared
 * message, so self-targeting buttons do appear; submitMove() rejects them.
 */
function ffaMoveKeyboard(battleId, cardKeys, alivePlayers) {
  const rows = [];
  for (const cardKey of cardKeys) {
    if (NO_TARGET_MOVES.has(cardKey)) {
      rows.push([Markup.button.callback(getCardLabel(cardKey), `mp:${battleId}:move:${cardKey}:0`)]);
    } else {
      for (const target of alivePlayers) {
        rows.push([Markup.button.callback(
          `${getCardLabel(cardKey)} → ${target.display_name}`,
          `mp:${battleId}:move:${cardKey}:${target.telegram_id}`
        )]);
      }
    }
  }
  for (const itemKey of SELF_ONLY_ITEMS) {
    rows.push([Markup.button.callback(`🎒 ${getCardLabel(itemKey)}`, `mp:${battleId}:item:${itemKey}`)]);
  }
  return Markup.inlineKeyboard(rows);
}

module.exports = { lobbyKeyboard, difficultyKeyboard, oneVsOneMoveKeyboard, ffaMoveKeyboard, SELF_ONLY_ITEMS, NO_TARGET_MOVES };
