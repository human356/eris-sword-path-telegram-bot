'use strict';
const { Markup } = require('telegraf');
const env = require('../../config/env');
const { scheduleDelete } = require('../../utils/messageCleanup');
const { botUsernameOf } = require('../../utils/shopText');

/**
 * /start gate: inside a group, a player who never pressed Start in the bot's
 * private chat gets a notice instead of an answer. Telegram doesn't let a bot
 * message people who didn't start it, and the shop / «جیب من» flows live in DM.
 *
 * Covered: any /command meant for this bot, the Persian trigger words, and button
 * presses — except buttons of battles that are ALREADY running (`battle:`, `mp:`),
 * so nobody gets locked out mid-fight.
 * Must be registered after ensureContext (needs ctx.state.user / isGroup).
 */
const NOTICE_COOLDOWN_MS = 5 * 1000;
const NOTICE_LIFETIME_MS = 30 * 1000;
const lastNotice = new Map(); // telegramId -> timestamp

const TRIGGER_WORDS = new Set(['پنل اریس', 'پروفایل اریس', 'شخصیت']);
const SKIP_CALLBACK_PREFIXES = ['battle:', 'mp:'];

function isBotInteraction(ctx) {
  if (ctx.callbackQuery) {
    const data = String(ctx.callbackQuery.data || '');
    return !SKIP_CALLBACK_PREFIXES.some((p) => data.startsWith(p));
  }
  const text = ctx.message && typeof ctx.message.text === 'string' ? ctx.message.text.trim() : '';
  if (!text) return false;
  const cmd = text.match(/^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]+))?(?:\s|$)/);
  if (cmd) {
    const mine = (ctx.botInfo && ctx.botInfo.username) || env.BOT_USERNAME;
    if (cmd[2] && mine && cmd[2].toLowerCase() !== mine.toLowerCase()) return false;
    return true;
  }
  return TRIGGER_WORDS.has(text);
}

async function startGate(ctx, next) {
  if (!ctx.state || !ctx.state.isGroup || !ctx.state.user) return next();
  if (ctx.state.user.started) return next();
  if (env.SUPER_ADMIN_IDS.includes(ctx.from.id)) return next();
  if (!isBotInteraction(ctx)) return next();

  const username = await botUsernameOf(ctx.telegram, ctx.botInfo);
  const url = username ? `https://t.me/${username}?start=gate` : null;

  if (ctx.callbackQuery) {
    // Telegram can open the bot directly from an alert-less callback via url.
    if (url) return ctx.answerCbQuery('اول باید ربات را در پیوی استارت کنید 👇', { url }).catch(() => {});
    return ctx.answerCbQuery('اول ربات را در پیوی استارت کنید.', { show_alert: true }).catch(() => {});
  }

  const now = Date.now();
  if (now - (lastNotice.get(ctx.from.id) || 0) < NOTICE_COOLDOWN_MS) return undefined;
  lastNotice.set(ctx.from.id, now);
  if (lastNotice.size > 5000) lastNotice.delete(lastNotice.keys().next().value);

  const name = ctx.state.user.displayName;
  const text =
    `⚠️ ${name}، قبل از استفاده از ربات باید یک‌بار آن را در پیوی استارت کنید.\n` +
    `روی دکمهٔ زیر بزنید، در پیوی «Start» را بزنید و بعد دوباره دستورتان را بفرستید.`;
  const extra = url ? Markup.inlineKeyboard([[Markup.button.url('▶️ استارت ربات در پیوی', url)]]) : {};
  const sent = await ctx.replyPersist(text, extra);
  if (sent) scheduleDelete(ctx.telegram, sent.chat.id, sent.message_id, NOTICE_LIFETIME_MS);
  return undefined;
}

module.exports = startGate;
