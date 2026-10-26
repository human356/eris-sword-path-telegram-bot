'use strict';
const playerStatsModel = require('../../database/models/playerStatsModel');
const showcaseModel = require('../../database/models/showcaseModel');
const { renderProfile, renderWelcome } = require('../views/profileView');
const { mainMenu } = require('../keyboards');
const profileCardService = require('../../services/profileCardService');
const { escapeHtml } = require('../../utils/format');
const { getThreadId } = require('../../utils/topic');

/**
 * Sends the image profile card (cached by Telegram file_id, see profileCardService).
 * Falls back to the old text profile when the card can't be produced
 * (e.g. the canvas library isn't installed) so /profile never breaks.
 */
async function replyProfile(ctx, finalStats) {
  const { user, groupId } = ctx.state;
  try {
    const threadId = getThreadId(ctx);
    await profileCardService.sendProfileCard(
      ctx.telegram,
      ctx.chat.id,
      { telegramId: user.telegramId, groupId, displayName: user.displayName, username: user.username },
      {
        autoDelete: true,
        extra: {
          caption: `⚔️ <b>${escapeHtml(user.displayName)}</b>`,
          parse_mode: 'HTML',
          ...(threadId ? { message_thread_id: threadId } : {}),
          ...mainMenu(),
        },
      }
    );
    return;
  } catch (err) {
    if (err.message !== 'PROFILE_CARD_UNAVAILABLE') console.error('[profile] card failed, using text profile:', err);
  }
  const showcaseItems = await showcaseModel.getShowcase(user.telegramId, groupId);
  await ctx.reply(renderProfile(user.displayName, finalStats, showcaseItems), { parse_mode: 'HTML', ...mainMenu() });
}

/**
 * Regen is now applied for everyone by a cron tick (src/regen/regenService.js),
 * so viewing the profile must NOT top anything up. The old on-view calculation
 * measured time since a stale last_*_regen_at (never reset when stamina was
 * spent), so the first /profile after a while refilled everything instantly.
 * Kept as a thin function so existing callers keep working; it just returns
 * the freshest stats.
 */
async function applyPassiveRegen(telegramId, groupId, stats) {
  const fresh = await playerStatsModel.getPlayerStats(telegramId, groupId);
  return fresh || stats;
}

function register(bot) {
  bot.command(['start', 'profile', 'panel'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const { stats, created } = await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId);
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);

    if (created) {
      await ctx.reply(renderWelcome(user.displayName, finalStats), { parse_mode: 'HTML', ...mainMenu() });
      return;
    }

    await replyProfile(ctx, finalStats);
  });

  bot.action('menu:profile', async (ctx) => {
    await ctx.answerCbQuery();
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);
    await replyProfile(ctx, finalStats);
  });
}

module.exports = { register, applyPassiveRegen };
