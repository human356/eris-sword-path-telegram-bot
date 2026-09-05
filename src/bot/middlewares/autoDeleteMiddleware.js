'use strict';
const { scheduleDelete } = require('../../utils/messageCleanup');

/**
 * Registered right after ensureContext (needs ctx.state.isGroup to already
 * be set). Inside a GROUP chat, this makes `ctx.reply(...)` auto-delete the
 * message it sends after the cleanup window by default — matching the
 * "most bot messages should disappear" request — while adding
 * `ctx.replyPersist(...)` (the original, unpatched ctx.reply) for the three
 * exempt categories: final battle result, per-round battle report, and
 * training result.
 *
 * Private/DM chats (e.g. the «جیب من» panel, which people need to keep
 * referring back to) are left completely untouched — ctx.reply there stays
 * a normal, permanent reply.
 *
 * This only covers messages sent via `ctx.reply`. Messages sent directly
 * through `bot.telegram.sendMessage` / `ctx.telegram.sendMessage` (used by
 * battleManager.js, multiplayerBattleManager.js, and erisEventService.js,
 * since those fire outside of a normal ctx handler) use the
 * `sendAutoDelete` / `sendPersist` helpers from messageCleanup.js directly
 * instead — see those files for the per-call-site category decisions.
 */
async function autoDeleteMiddleware(ctx, next) {
  if (ctx.reply) {
    const originalReply = ctx.reply.bind(ctx);
    ctx.replyPersist = originalReply;

    const isGroup = ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');
    if (isGroup) {
      ctx.reply = async (text, extra) => {
        const msg = await originalReply(text, extra);
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
