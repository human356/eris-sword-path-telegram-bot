'use strict';
const { Markup } = require('telegraf');
const env = require('../../config/env');
const characterModel = require('../../database/models/characterModel');
const playerStatsModel = require('../../database/models/playerStatsModel');
const userModel = require('../../database/models/userModel');
const characterCardService = require('../../services/characterCardService');
const topicService = require('../../services/topicService');
const { botUsernameOf, buyUrl } = require('../../utils/shopText');
const { escapeHtml } = require('../../utils/format');
const { getThreadId, threadExtra } = require('../../utils/topic');
const { scheduleDelete } = require('../../utils/messageCleanup');

/**
 * «شخصیت» — the player's semi-pixel character.
 *  - group: /character, the word «شخصیت», the main-menu button and the «اریس» reply picker
 *    post the 8:10 character card (needs the doll bought in the shop: CHARACTER_DOLL);
 *  - private: /start char_<groupId> (button under the card) opens the customisation Mini App.
 */
const CHAR_START_RE = /^char_(-?\d+)$/;

/** "@username" when the user has one, otherwise a clickable name link. */
function mention(user) {
  if (user.username) return `@${escapeHtml(user.username)}`;
  return `<a href="tg://user?id=${user.telegram_id || user.telegramId}">${escapeHtml(user.display_name || user.displayName || '—')}</a>`;
}

function webAppUrl(groupId) {
  if (!env.WEBAPP_URL) return null;
  return `${env.WEBAPP_URL}/app${groupId ? `?g=${groupId}` : ''}`;
}

/**
 * Posts the character card of `target` ({ telegram_id, display_name, username }) into the group.
 * `tag` adds the target's @username under the picture. Returns false when nothing was sent as a card.
 */
async function showCharacter(telegram, { chatId, groupId, threadId = 0, target, requester = null, tag = false, botUsername = null }) {
  const thread = threadExtra(threadId);
  const reply = (text, extra = {}) => telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...thread, ...extra }).then((m) => {
    scheduleDelete(telegram, chatId, m.message_id);
    return m;
  });
  const isSelf = requester && Number(requester.telegram_id) === Number(target.telegram_id);

  const stats = await playerStatsModel.getPlayerStats(target.telegram_id, groupId);
  if (!stats) {
    await reply(`⚠️ ${mention(target)} هنوز در این گروه پروفایلی ندارد.`);
    return false;
  }
  if (!(await characterModel.hasCharacter(target.telegram_id, groupId))) {
    const rows = [];
    if (isSelf && botUsername) rows.push([Markup.button.url('🪆 خرید عروسک (۴۰۰ سکه)', buyUrl(botUsername, characterModel.DOLL_KEY, groupId))]);
    await reply(
      isSelf
        ? '🪆 هنوز شخصیتی ندارید. برای باز شدن بخش «شخصیت»، <b>عروسک</b> را از ابتدای فروشگاه با ۴۰۰ سکه بخرید.'
        : `🪆 ${mention(target)} هنوز شخصیتی نساخته است (عروسک را از فروشگاه نخریده).`,
      rows.length ? Markup.inlineKeyboard(rows) : {}
    );
    return false;
  }

  const caption = `🎭 <b>شخصیت</b> ${tag ? mention(target) : escapeHtml(target.display_name || '')}`.trim();
  const rows = botUsername ? [[Markup.button.url('🎨 شخصی‌سازی شخصیت', `https://t.me/${botUsername}?start=char_${groupId}`)]] : [];
  try {
    await characterCardService.sendCharacterCard(
      telegram, chatId,
      { telegramId: target.telegram_id, groupId, displayName: target.display_name, username: target.username },
      { autoDelete: true, extra: { caption, parse_mode: 'HTML', ...thread, ...(rows.length ? Markup.inlineKeyboard(rows) : {}) } }
    );
    return true;
  } catch (err) {
    console.error('[character] card failed:', err);
    await reply('⚠️ ساخت تصویر شخصیت الان ممکن نیست. کمی بعد دوباره امتحان کنید.');
    return false;
  }
}

/** /start char_<groupId> in private: button that opens the Mini App. */
async function handleCharacterStart(ctx, payload) {
  const m = CHAR_START_RE.exec(payload || '');
  if (!m) return false;
  const groupId = Number(m[1]);
  if (!(await characterModel.hasCharacter(ctx.from.id, groupId))) {
    await ctx.reply('🪆 برای شخصی‌سازی شخصیت اول باید «عروسک» را از فروشگاه همان گروه بخرید (۴۰۰ سکه).');
    return true;
  }
  await sendOpenButton(ctx, groupId);
  return true;
}

async function sendOpenButton(ctx, groupId) {
  const url = webAppUrl(groupId);
  if (!url) {
    await ctx.reply('🎨 مینی‌اپ شخصی‌سازی هنوز راه‌اندازی نشده است (ادمین باید WEBAPP_URL را تنظیم کند).');
    return;
  }
  await ctx.reply('🎨 برای ساخت و شخصی‌سازی شخصیت‌تان دکمهٔ زیر را بزنید:', Markup.inlineKeyboard([
    [Markup.button.webApp('🎭 شخصی‌سازی شخصیت', url)],
  ]));
}

function register(bot) {
  const handler = async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const username = await botUsernameOf(ctx.telegram, ctx.botInfo);
    const threadId = await topicService.resolveAnnounceThread(groupId, 'PROFILE', getThreadId(ctx)).catch(() => getThreadId(ctx));
    const self = { telegram_id: user.telegramId, display_name: user.displayName, username: user.username };
    await showCharacter(ctx.telegram, { chatId: ctx.chat.id, groupId, threadId, target: self, requester: self, botUsername: username });
  };

  bot.command(['character', 'shakhsiat'], handler);
  bot.hears((text) => typeof text === 'string' && text.trim() === 'شخصیت', handler);
  bot.action('menu:character', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    return handler(ctx);
  });
}

module.exports = { register, showCharacter, handleCharacterStart, sendOpenButton, mention };
