'use strict';
const C = require('../config/constants');
const slots = require('../config/imageSlots');
const imageService = require('./imageService');
const characterModel = require('../database/models/characterModel');
const { drawBattleResult } = require('../character/resultCard');
const { loadCanvas } = require('../utils/canvasDraw');
const { threadExtra } = require('../utils/topic');

/**
 * Posts the battle-result picture as a REPLY to the last round report (instead of the long result text).
 * Returns the sent message, or null when the picture can't be produced (the caller then sends the
 * old text result, so a missing canvas library / picture never loses the result).
 */
const LRM = '‎';
const signed = (n) => `${LRM}${n >= 0 ? '+' : '-'}${Math.abs(Math.round(n))}`;

async function bufferOf(slotKey) {
  try {
    return await imageService.getBuffer(slotKey);
  } catch (err) {
    console.error('[result-card] picture unavailable:', slotKey, err.message);
    return null;
  }
}

/**
 * data: { groupId, threadId, title, subtitle, eris: 'win'|'lose'|null, sides: [side, side] } — a side is
 *   { role, members: [{ telegramId?, name, level?, hp?, hpMax?, kind, lines }] }  (see character/resultCard.js)
 * options: { replyToMessageId, caption }
 */
async function sendResultCard(telegram, chatId, data, { replyToMessageId = null, caption = '' } = {}) {
  const lib = loadCanvas();
  if (!lib) return null;
  try {
    for (const side of data.sides) {
      for (const m of side.members) {
        if (m.kind === 'eris' || !m.telegramId) continue;
        const ch = await characterModel.getCharacter(m.telegramId, data.groupId);
        m.appearance = ch.appearance;
        m.outfit = ch.outfit;
      }
    }
    const canvas = await drawBattleResult(lib, data, {
      background: await bufferOf(slots.resultSlot('bg')),
      erisWin: await bufferOf(slots.resultSlot('eris_win')),
      erisLose: await bufferOf(slots.resultSlot('eris_lose')),
    });
    const buffer = await canvas.encode('jpeg', C.PROFILE_CARD_JPEG_QUALITY);
    const extra = { caption: caption.slice(0, 1000), parse_mode: 'HTML', ...threadExtra(data.threadId) };
    if (replyToMessageId) extra.reply_parameters = { message_id: replyToMessageId, allow_sending_without_reply: true };
    // Persist: this IS the final battle result (exempt from the group auto-cleanup).
    return await telegram.sendPhoto(chatId, { source: buffer, filename: 'battle-result.jpg' }, extra);
  } catch (err) {
    console.error('[result-card] failed, falling back to text:', err);
    return null;
  }
}

module.exports = { sendResultCard, signed };
