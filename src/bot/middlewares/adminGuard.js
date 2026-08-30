'use strict';
const env = require('../../config/env');

async function isGroupAdmin(ctx) {
  if (env.SUPER_ADMIN_IDS.includes(ctx.from.id)) return true;
  if (!ctx.state.isGroup) return false;
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === 'administrator' || member.status === 'creator';
  } catch {
    return false;
  }
}

async function requireAdmin(ctx) {
  const ok = await isGroupAdmin(ctx);
  if (!ok) {
    await ctx.reply('🚫 This command is restricted to group admins.');
  }
  return ok;
}

module.exports = { isGroupAdmin, requireAdmin };
