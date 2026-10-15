'use strict';
const { scheduleDelete } = require('../../utils/messageCleanup');
const { getThreadId } = require('../../utils/topic');

/**
 * Registered right after ensureContext (needs ctx.state.isGroup to already
 * be set). Inside a GROUP chat, this makes `ctx.reply(...)` auto-delete the
 * message it sends after the cleanup window by default, while adding
 * `ctx.replyPersist(...)` (never auto-deleted) for the exempt categories:
 * final battle result, per-round battle report, and training result.
 *
 * Topics: every reply is explicitly sent into the topic the update came from
 * (message_thread_id), so answers never jump to the General topic.
 *
 * Private/DM chats are left completely untouched.
 */
async function autoDeleteMiddleware(ctx, next) {
  if (ctx.reply) {
    const originalReply = ctx.reply.bind(ctx);
    const isGroup = ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');
    const threadId = isGroup ? getThreadId(ctx) : 0;
    const withThread = (extra) => (
      threadId && !(extra && extra.message_thread_id) ? { ...(extra || {}), message_thread_id: threadId } : extra
    );

    ctx.replyPersist = (text, extra) => originalReply(text, withThread(extra));

    if (isGroup) {
      ctx.reply = async (text, extra) => {
        const msg = await originalReply(text, withThread(extra));
        if (msg && msg.chat) {
          scheduleDelete(ctx.telegram, msg.chat.id, msg.message_id);
        }
        return msg;
      };
    }
  }
  return next();
}

module.exports = autoDeleteMiddleware;
