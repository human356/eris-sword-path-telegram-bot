'use strict';
const userModel = require('../../database/models/userModel');
const groupModel = require('../../database/models/groupModel');
const { displayNameOf } = require('../../utils/format');

/**
 * Populates ctx.state.user (global user row) and ctx.state.groupId.
 * The game is group-only (spec §1: "no Mini App, no website"), so private
 * chats get a friendly notice instead of being processed as gameplay.
 */
async function ensureContext(ctx, next) {
  if (!ctx.from) return next();

  const isGroup = ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');

  const user = await userModel.upsertUser({
    telegramId: ctx.from.id,
    username: ctx.from.username,
    displayName: displayNameOf(ctx.from),
  });

  if (user.is_banned) {
    return; // silently ignore banned users
  }

  ctx.state = ctx.state || {};
  ctx.state.user = { telegramId: user.telegram_id, displayName: user.display_name, username: user.username };

  if (!isGroup) {
    ctx.state.isGroup = false;
    if (ctx.updateType === 'message' && ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
      await ctx.reply('⚔️ Eris — Sword Path only works inside a Telegram group. Add me to a group and try again there!');
    }
    return;
  }

  ctx.state.isGroup = true;
  ctx.state.groupId = ctx.chat.id;

  await groupModel.upsertGroup({ groupId: ctx.chat.id, groupName: ctx.chat.title });

  return next();
}

module.exports = ensureContext;
