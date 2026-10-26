'use strict';
const slots = require('../config/imageSlots');
const imageService = require('./imageService');
const erisVoice = require('../eris/erisVoice');
const { escapeHtml } = require('../utils/format');
const { scheduleDelete } = require('../utils/messageCleanup');

/** Clickable name: @username -> t.me link, otherwise a tg://user mention. */
function mentionHtml(user) {
  const name = escapeHtml(user.displayName || 'بازیکن');
  if (user.username) {
    return `<b>${name}</b> (<a href="https://t.me/${user.username}">@${escapeHtml(user.username)}</a>)`;
  }
  return `<a href="tg://user?id=${user.telegramId}">${name}</a>`;
}

function captionFor(user, level) {
  return (
    `🎉 <b>تبریک!</b> ${mentionHtml(user)} به <b>سطح ${level}</b> ارتقا یافت!\n\n` +
    `Eris: "${escapeHtml(erisVoice.say('level_up'))}"`
  );
}

/**
 * Photo post announcing a level-up, sent as a REPLY to the player's training
 * message. Picture: level:<N> if the super admin configured one, otherwise
 * level:default; with neither, a plain text reply is sent.
 * Never throws — a failed celebration must not break training.
 */
async function postLevelUp(telegram, { chatId, threadId = 0, replyToMessageId, user, level }) {
  const caption = captionFor(user, level);
  const base = {
    parse_mode: 'HTML',
    ...(threadId ? { message_thread_id: threadId } : {}),
    ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId, allow_sending_without_reply: true } } : {}),
  };

  try {
    const photo = await imageService.photoForFirst([slots.levelSlot(level), slots.LEVEL_DEFAULT_SLOT]);
    let msg;
    if (photo) {
      msg = await telegram.sendPhoto(chatId, photo.input, { caption, ...base });
      await photo.remember(msg).catch(() => {});
    } else {
      msg = await telegram.sendMessage(chatId, caption, { ...base, link_preview_options: { is_disabled: true } });
    }
    scheduleDelete(telegram, chatId, msg.message_id);
    return msg;
  } catch (err) {
    console.error('[level-up] could not post level-up message:', err.message);
    return null;
  }
}

module.exports = { postLevelUp, captionFor, mentionHtml };
