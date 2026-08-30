'use strict';
const { requireAdmin } = require('../middlewares/adminGuard');
const playerStatsModel = require('../../database/models/playerStatsModel');
const userModel = require('../../database/models/userModel');
const groupModel = require('../../database/models/groupModel');
const { query } = require('../../database/pool');
const rageModel = require('../../database/models/rageModel');
const eventModel = require('../../database/models/eventModel');
const erisEventService = require('../../events/erisEventService');
const { displayNameOf, num, escapeHtml } = require('../../utils/format');
const C = require('../../config/constants');

function getTargetFromReply(ctx) {
  const reply = ctx.message.reply_to_message;
  if (!reply || !reply.from) return null;
  return { telegramId: reply.from.id, displayName: displayNameOf(reply.from), username: reply.from.username };
}

function register(bot) {
  // /give <coins|xp> <amount> — reply to a player
  bot.command('give', async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await requireAdmin(ctx))) return;

    const target = getTargetFromReply(ctx);
    if (!target) return ctx.reply('Reply to the player you want to reward with /give <coins|xp> <amount>.');

    const parts = (ctx.message.text || '').trim().split(/\s+/);
    const [, resource, amountRaw] = parts;
    const amount = parseInt(amountRaw, 10);
    if (!['coins', 'xp'].includes(resource) || !Number.isFinite(amount) || amount <= 0) {
      return ctx.reply('Usage: /give <coins|xp> <amount> (as a reply to the player)');
    }

    await userModel.upsertUser({ telegramId: target.telegramId, username: target.username, displayName: target.displayName });
    const stats = (await playerStatsModel.getOrCreatePlayerStats(target.telegramId, ctx.state.groupId)).stats;

    if (resource === 'coins') {
      await playerStatsModel.updatePlayerStats(target.telegramId, ctx.state.groupId, { coins: stats.coins + amount });
      await ctx.reply(`🪙 Gave ${num(amount)} Coins to ${escapeHtml(target.displayName)}.`, { parse_mode: 'HTML' });
    } else {
      const xpService = require('../../ranking/xpService');
      await xpService.grantXp(target.telegramId, ctx.state.groupId, stats, amount);
      await ctx.reply(`⭐ Gave ${num(amount)} XP to ${escapeHtml(target.displayName)}.`, { parse_mode: 'HTML' });
    }
  });

  // /ban and /unban — global ban (spec: admin moderation)
  bot.command('ban', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const target = getTargetFromReply(ctx);
    if (!target) return ctx.reply('Reply to the user you want to ban with /ban.');
    await userModel.setBanned(target.telegramId, true);
    await ctx.reply(`🚫 ${escapeHtml(target.displayName)} has been banned from the game.`, { parse_mode: 'HTML' });
  });

  bot.command('unban', async (ctx) => {
    if (!(await requireAdmin(ctx))) return;
    const target = getTargetFromReply(ctx);
    if (!target) return ctx.reply('Reply to the user you want to unban with /unban.');
    await userModel.setBanned(target.telegramId, false);
    await ctx.reply(`✅ ${escapeHtml(target.displayName)} has been unbanned.`, { parse_mode: 'HTML' });
  });

  // /resetplayer — wipes a player's progress in this group only
  bot.command('resetplayer', async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await requireAdmin(ctx))) return;
    const target = getTargetFromReply(ctx);
    if (!target) return ctx.reply('Reply to the player you want to reset with /resetplayer.');

    await query('DELETE FROM player_group_stats WHERE telegram_id = $1 AND group_id = $2', [
      target.telegramId, ctx.state.groupId,
    ]);
    await ctx.reply(`♻️ Reset ${escapeHtml(target.displayName)}'s progress in this group.`, { parse_mode: 'HTML' });
  });

  // /startevent — force-starts an Eris Challenge event immediately
  bot.command('startevent', async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await requireAdmin(ctx))) return;

    const existing = await eventModel.getActiveEvent(ctx.state.groupId);
    if (existing) return ctx.reply('An Eris Challenge is already active.');

    const event = await eventModel.createEvent(ctx.state.groupId, 'ERIS_CHALLENGE');
    await rageModel.resetRage(ctx.state.groupId);
    await erisEventService.announceEvent(ctx.telegram, event, ctx.chat.id);
  });

  // /settings — toggle cooldowns / anti-abuse for this group
  bot.command('settings', async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (!(await requireAdmin(ctx))) return;

    const parts = (ctx.message.text || '').trim().split(/\s+/);
    const [, key, value] = parts;
    const settings = await groupModel.getSettings(ctx.state.groupId);

    if (!key) {
      return ctx.reply(
        `⚙️ <b>Group Settings</b>\n\n` +
        `Cooldowns enabled: ${settings.cooldowns_enabled}\n` +
        `Anti-abuse enabled: ${settings.anti_abuse_enabled}\n\n` +
        `Usage: /settings <cooldowns|antiabuse> <on|off>`,
        { parse_mode: 'HTML' }
      );
    }

    const column = key === 'cooldowns' ? 'cooldowns_enabled' : key === 'antiabuse' ? 'anti_abuse_enabled' : null;
    if (!column || !['on', 'off'].includes(value)) {
      return ctx.reply('Usage: /settings <cooldowns|antiabuse> <on|off>');
    }

    await query(`UPDATE settings SET ${column} = $2 WHERE group_id = $1`, [ctx.state.groupId, value === 'on']);
    await ctx.reply(`✅ ${key} set to ${value}.`);
  });
}

module.exports = { register };
