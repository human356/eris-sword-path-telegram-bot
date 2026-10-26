'use strict';
const userModel = require('../../database/models/userModel');
const groupModel = require('../../database/models/groupModel');
const env = require('../../config/env');
const { displayNameOf } = require('../../utils/format');

/**
 * Populates ctx.state.user (global user row) and ctx.state.groupId.
 * The game is group-only (spec §1: "no Mini App, no website"), so private
 * chats get a friendly notice instead of being processed as gameplay.
 *
 * Exception: private callback queries (inline-button taps) ARE let through.
 * This is what powers "جیب من" — it's DM'd to the player so nobody else in
 * the group can see it, and its buttons (loadout editing, item consumption)
 * need to keep working there. Those handlers must get the group id from the
 * callback_data themselves, since ctx.state.groupId is never set outside a
 * group chat.
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
  ctx.state.user = { telegramId: user.telegram_id, displayName: user.display_name, username: user.username, started: !!user.started_bot };


if (!isGroup) {
  ctx.state.isGroup = false;

  // ----------------------------------------------------------
  // Deep Link های خصوصی باید اجازه عبور داشته باشند.
  // مثال:
  // /start jib_-1001234567890
  // ----------------------------------------------------------
  if (
    ctx.updateType === 'message' &&
    ctx.message &&
    typeof ctx.message.text === 'string' &&
    ctx.message.text.startsWith('/start')
  ) {
    return next();
  }

  // Inline queries ("@bot shop" typed in a group's text box) have no chat.
  if (ctx.updateType === 'inline_query') {
    return next();
  }

  // Super admins manage the bot's pictures in private: they send photos / texts
  // (see bot/commands/adminImages.js), which must not be dropped here.
  if (
    ctx.updateType === 'message' &&
    ctx.message &&
    env.SUPER_ADMIN_IDS.includes(ctx.from.id) &&
    (ctx.message.photo || ctx.message.document || (ctx.message.text && !ctx.message.text.startsWith('/')))
  ) {
    return next();
  }

  // Admin panel commands in private.
  if (
    ctx.updateType === 'message' &&
    ctx.message &&
    typeof ctx.message.text === 'string' &&
    /^\/(admin|images)(@\w+)?(\s|$)/i.test(ctx.message.text) &&
    env.SUPER_ADMIN_IDS.includes(ctx.from.id)
  ) {
    return next();
  }

  // ----------------------------------------------------------
  // Private callback queries
  // برای دکمه‌های «جیب من» در PV
  // ----------------------------------------------------------
  if (ctx.callbackQuery) {
    return next();
  }

  // ----------------------------------------------------------
  // سایر دستورات خصوصی
  // ----------------------------------------------------------
  if (
    ctx.updateType === 'message' &&
    ctx.message &&
    ctx.message.text &&
    ctx.message.text.startsWith('/')
  ) {
    await ctx.reply(
      '⚔️ اریس — Sword Path فقط داخل گروه تلگرام کار می‌کند. ' +
      'من را به یک گروه اضافه کنید و دوباره آنجا امتحان کنید!'
    );
  }

  return;
}

  ctx.state.isGroup = true;
  ctx.state.groupId = ctx.chat.id;

  await groupModel.upsertGroup({ groupId: ctx.chat.id, groupName: ctx.chat.title });

  return next();
}

module.exports = ensureContext;
