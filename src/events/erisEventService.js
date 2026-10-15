'use strict';
const C = require('../config/constants');
const eventModel = require('../database/models/eventModel');
const playerStatsModel = require('../database/models/playerStatsModel');
const userModel = require('../database/models/userModel');
const xpService = require('../ranking/xpService');
const coinService = require('../economy/coinService');
const rageModel = require('../database/models/rageModel');
const achievementModel = require('../database/models/achievementModel');
const erisVoice = require('../eris/erisVoice');
const { erisEventKeyboard } = require('../bot/keyboards');
const { num, escapeHtml } = require('../utils/format');
// Phase 6: group-chat message cleanup. The Eris Challenge event's own
// announcement/results messages are NOT one of the 3 exempt categories
// named in the request (final battle result / round report / training
// result) — an "event" isn't a "duel" in that literal sense — so both get
// auto-deleted like everything else here. If that's not the intent, swap
// `sendAutoDelete` for `sendPersist` in resolveEvent() below; it's a one-line change.
const { sendAutoDelete } = require('../utils/messageCleanup');
const { threadExtra } = require('../utils/topic');
const topicService = require('../services/topicService');

/**
 * Sends the "Eris Challenge started" message for a freshly created event row.
 * `telegramClient` is Telegraf's `bot.telegram` (or `ctx.telegram`) — anything
 * exposing `.sendMessage`.
 */
async function announceEvent(telegramClient, event, chatId, originThreadId = 0) {
  const text =
    `⚔️ <b>ERIS CHALLENGE</b>\n\n` +
    `Eris:\n"${erisVoice.say('eris_event_start')}"\n\n` +
    `همه اعضای گروه می‌تونن شرکت کنن! هرکس یک حمله داره.\n` +
    `⏱ Event active for ${C.ERIS_EVENT_DURATION_MINUTES} minutes.`;

  // If an admin pinned the event section to certain topics, announce there.
  const threadId = await topicService.resolveAnnounceThread(event.group_id, 'RAGE_EVENT', originThreadId || 0);
  await eventModel.setThreadId(event.id, threadId);
  const sent = await sendAutoDelete(telegramClient, chatId, text, { parse_mode: 'HTML', ...threadExtra(threadId), ...erisEventKeyboard(event.id) });
  await eventModel.setChatMessageId(event.id, sent.message_id);
}

/** One player's single attempt against Eris in the active event. */
async function attack(groupId, telegramId) {
  const event = await eventModel.getActiveEvent(groupId);
  if (!event) return { success: false, reason: 'NO_EVENT' };
  if (new Date(event.ends_at).getTime() < Date.now()) return { success: false, reason: 'EXPIRED' };

  const already = await eventModel.hasAttempted(event.id, telegramId);
  if (already) return { success: false, reason: 'ALREADY_ATTEMPTED' };

  const stats = (await playerStatsModel.getOrCreatePlayerStats(telegramId, groupId)).stats;
  const variance = 0.8 + Math.random() * 0.4; // 0.8x - 1.2x
  const critMultiplier = Math.random() < Number(stats.crit_chance) ? C.CRIT_DAMAGE_MULTIPLIER : 1;
  const damage = Math.max(1, Math.round(stats.attack * variance * critMultiplier * 8));

  await eventModel.recordAttempt(event.id, telegramId, damage);
  await achievementModel.unlock(telegramId, groupId, 'RAGE_SURVIVOR');

  return { success: true, damage, event };
}

/** Resolves a finished event: pays out the top 3 by damage and resets rage. */
async function resolveEvent(bot, event) {
  const leaderboard = await eventModel.getLeaderboard(event.id, 10);
  const groupId = event.group_id;

  const rewardTiers = [
    { xp: 500, coins: 800, respect: 20 },
    { xp: 350, coins: 500, respect: 12 },
    { xp: 200, coins: 300, respect: 8 },
  ];const medals = ['🥇', '🥈', '🥉'];

  let text = `🏆 <b>نتایج رویداد اریس</b>\n\n`;
  
  if (leaderboard.length === 0) {
    text += `این بار هیچ‌کس جرئت مبارزه با اریس را نداشت...\n\nEris: "ترسوها. همه‌تان."`;
  } else {
    for (let i = 0; i < leaderboard.length; i += 1) {
      const row = leaderboard[i];
      const medal = medals[i] || `${i + 1}️⃣`;
  
      text += `${medal} ${escapeHtml(row.display_name)} — ${num(row.damage)} آسیب\n`;
    }
  
    text += `\nپاداش‌ها:\nXP\nسکه\nاحترام اریس\nدستاورد ویژه (۳ نفر برتر)\n\n`;
    for (let i = 0; i < Math.min(3, leaderboard.length); i += 1) {
      const row = leaderboard[i];
      const tier = rewardTiers[i];
      const stats = (await playerStatsModel.getOrCreatePlayerStats(row.telegram_id, groupId)).stats;
      const xpResult = await xpService.grantXp(row.telegram_id, groupId, stats, tier.xp);
      const updated = await coinService.grantCoins(row.telegram_id, groupId, xpResult.stats, tier.coins, 'ERIS_EVENT');
      await playerStatsModel.updatePlayerStats(row.telegram_id, groupId, {
        eris_respect: updated.eris_respect + tier.respect,
        has_won_eris_challenge: true,
      });
    }

    text += `Eris:\n"${erisVoice.say('eris_event_end')}"`;
  }

  await rageModel.resetRage(groupId);
  await eventModel.finishEvent(event.id, { leaderboard });

  await sendAutoDelete(bot.telegram, groupId, text, { parse_mode: 'HTML', ...threadExtra(event.thread_id) }).catch(() => {});
}

/** Cron-driven sweep: finds and resolves any Eris events whose timer has run out. */
async function sweepExpiredEvents(bot) {
  const expired = await eventModel.getExpiredActiveEvents();
  for (const event of expired) {
    await resolveEvent(bot, event);
  }
}

module.exports = { announceEvent, attack, resolveEvent, sweepExpiredEvents };
