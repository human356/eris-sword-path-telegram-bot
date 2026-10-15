'use strict';

/**
 * Telegram forum "topics" helpers.
 *
 * Thread id 0 means "General" (or a group without topics enabled). In a forum
 * supergroup the General topic has NO message_thread_id, and for ordinary
 * (non-forum) groups message_thread_id can also be set for plain reply chains —
 * so a thread id is only trusted when the message is flagged is_topic_message.
 */
function getThreadId(ctx) {
  const msg =
    (ctx.callbackQuery && ctx.callbackQuery.message) ||
    ctx.message ||
    ctx.editedMessage ||
    null;
  if (msg && msg.is_topic_message && msg.message_thread_id) {
    return Number(msg.message_thread_id);
  }
  return 0;
}

/** Extra options to spread into any send call so it lands in the right topic. */
function threadExtra(threadId) {
  return threadId ? { message_thread_id: Number(threadId) } : {};
}

module.exports = { getThreadId, threadExtra };
