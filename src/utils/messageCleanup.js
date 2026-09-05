'use strict';
const C = require('../config/constants');

/**
 * Group-chat message cleanup (Phase 6). Most bot messages sent into a GROUP
 * are auto-deleted BOT_MESSAGE_AUTODELETE_MS after being sent, so the group
 * doesn't get cluttered. Three categories are exempt and must be sent with
 * `sendPersist` / `ctx.replyPersist` instead:
 *   1. Final battle result (duel finalizeBattle, multiplayer finishMultiplayerBattle)
 *   2. Per-round battle report (duel sendRoundReport, multiplayer round-report texts)
 *   3. Training result (train.js's final "تمرین با موفقیت انجام شد" message)
 * Private/DM messages (e.g. «جیب من») are never touched by any of this —
 * see autoDeleteMiddleware.js, which only patches ctx.reply inside groups.
 *
 * Timers are in-process only (same pattern already used for round/challenge
 * timers in battleManager.js) — if the bot restarts within the 10-minute
 * window, a handful of older messages may simply be left un-deleted rather
 * than crash-looping trying to recover timer state. Acceptable per the
 * project's existing "in-memory timers, Postgres stays the source of truth
 * for everything that matters" convention (see README "Notes on scaling").
 */

function scheduleDelete(telegram, chatId, messageId, delayMs = C.BOT_MESSAGE_AUTODELETE_MS) {
  if (!messageId) return;
  setTimeout(() => {
    telegram.deleteMessage(chatId, messageId).catch(() => {});
  }, delayMs);
}

/** Sends a message into a GROUP that should be auto-deleted after the cleanup window. */
async function sendAutoDelete(telegram, chatId, text, extra = {}) {
  const msg = await telegram.sendMessage(chatId, text, extra);
  scheduleDelete(telegram, chatId, msg.message_id);
  return msg;
}

/** Sends a message that must NEVER be auto-deleted (the 3 exceptions above). */
async function sendPersist(telegram, chatId, text, extra = {}) {
  return telegram.sendMessage(chatId, text, extra);
}

module.exports = { scheduleDelete, sendAutoDelete, sendPersist };
