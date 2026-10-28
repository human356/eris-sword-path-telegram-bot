'use strict';
const { Markup } = require('telegraf');
const playerStatsModel = require('../../database/models/playerStatsModel');
const showcaseModel = require('../../database/models/showcaseModel');
const battleModel = require('../../database/models/battleModel');
const mpModel = require('../../database/models/multiplayerBattleModel');
const { getRankByKey } = require('../../utils/rankUtil');
const { escapeHtml } = require('../../utils/format');
const { renderProfile } = require('../views/profileView');
const { mainMenu } = require('../keyboards');
const { difficultyKeyboard } = require('../keyboardsMultiplayer');
const { applyPassiveRegen } = require('./profile');
const userModel = require('../../database/models/userModel');
const profileCardService = require('../../services/profileCardService');
const characterCommand = require('./character');
const { botUsernameOf } = require('../../utils/shopText');
const { getThreadId, threadExtra } = require('../../utils/topic');
const { displayNameOf } = require('../../utils/format');

/**
 * The message a text really replies to, or null. In forum groups EVERY message sent inside a topic
 * carries a `reply_to_message` pointing at the topic's first (service) message — that is not a reply
 * and must not turn the plain «اریس» panel into the profile/character picker.
 */
function realReplyOf(msg) {
  const r = msg && msg.reply_to_message;
  if (!r) return null;
  if (r.forum_topic_created || r.forum_topic_edited || r.forum_topic_closed || r.forum_topic_reopened || r.general_forum_topic_hidden || r.general_forum_topic_unhidden) return null;
  if (msg.is_topic_message && msg.message_thread_id && r.message_id === msg.message_thread_id) return null;
  if (!r.from && !r.sender_chat) return null; // service messages
  return r;
}

/**
 * Who does a reply to «اریس» point at?
 *  - the replied message is only an @username (or a text-mention) -> that person;
 *  - otherwise the author of the replied message.
 * Returns { target } or { error }.
 */
async function resolveReplyTarget(ctx) {
  const r = realReplyOf(ctx.message);
  if (!r) return null;
  const text = (r.text || r.caption || '').trim();
  const entities = r.entities || r.caption_entities || [];
  const whole = entities.find((e) => (e.type === 'mention' || e.type === 'text_mention') && text.slice(e.offset, e.offset + e.length) === text);
  if (whole && whole.type === 'text_mention' && whole.user && !whole.user.is_bot) {
    const row = await userModel.getUser(whole.user.id);
    return { target: row || { telegram_id: whole.user.id, display_name: displayNameOf(whole.user), username: whole.user.username || null } };
  }
  if (whole && whole.type === 'mention') {
    const row = await userModel.getUserByUsername(text.slice(1));
    return row ? { target: row } : { error: `کاربری با یوزرنیم ${text} پیدا نشد (باید قبلاً با ربات کار کرده باشد).` };
  }
  if (!r.from || r.from.is_bot) return { error: 'این یک ربات است، بازیکن نیست 🙂' };
  const row = await userModel.getUser(r.from.id);
  return { target: row || { telegram_id: r.from.id, display_name: displayNameOf(r.from), username: r.from.username || null } };
}

function viewKeyboard(targetId, requesterId) {
  return Markup.inlineKeyboard([[
    Markup.button.callback('👤 پروفایل', `view:p:${targetId}:${requesterId}`),
    Markup.button.callback('🎭 شخصیت', `view:c:${targetId}:${requesterId}`),
  ]]);
}

function erisPanelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏋️ مبارزه تمرینی با اریس', 'eris:pve'),
      Markup.button.callback('👥 مبارزه تیمی', 'eris:team'),
      Markup.button.callback('🤺 مبارزه آزاد ۳ نفره', 'eris:ffa'),
    ],
    [
      Markup.button.callback('🏋️ تمرین', 'menu:training'),
    ]
    ,[
      Markup.button.callback('🎒 جیب من', 'menu:inventory'),
      Markup.button.callback('🛒 فروشگاه', 'menu:shop'),
    ],
  ]);
}

async function hasAnyActiveBattle(groupId, telegramId) {
  const duel = await battleModel.getActiveBattleForUser(groupId, telegramId);
  if (duel) return true;
  const mp = await mpModel.getActiveBattleForUser(groupId, telegramId);
  return !!mp;
}

function isExactText(target) {
  return (text) => typeof text === 'string' && text.trim() === target;
}

function register(bot, multiplayerBattleManager) {
  // ---------- «اریس» ----------
  bot.hears(isExactText('اریس'), async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;

    // «اریس» as a reply to someone (or to a message that is just their @username): ask what to show.
    if (realReplyOf(ctx.message)) {
      const res = await resolveReplyTarget(ctx);
      // replying to a bot / unknown user: just open the normal Eris panel below
      if (res && res.error && !/ربات/.test(res.error)) return ctx.reply(res.error);
      if (res && res.target) {
        const t = res.target;
        return ctx.reply(
          `🗡 میخواهید چه چیزِ ${characterCommand.mention(t)} را ببینید؟`,
          { parse_mode: 'HTML', ...viewKeyboard(t.telegram_id, user.telegramId) }
        );
      }
    }
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const rank = getRankByKey(stats.sword_rank);

    const text =
      `جونم؟ <a href="tg://user?id=${user.telegramId}">${escapeHtml(user.displayName)}</a>\n` +
      `${rank ? rank.label : stats.sword_rank}`;

    await ctx.reply(text, { parse_mode: 'HTML', ...erisPanelKeyboard() });
  });

  // ---------- «پنل اریس» ----------
  bot.hears(isExactText('پنل اریس'), async (ctx) => {
    if (!ctx.state.isGroup) return;
    await ctx.reply(
      '⚔️ <b>پنل اریس</b>\n\nیکی از گزینه‌های زیر را انتخاب کنید:',
      { parse_mode: 'HTML', ...mainMenu() }
    );
  });

  // ---------- «پروفایل اریس» ----------
  bot.hears(isExactText('پروفایل اریس'), async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    const stats = (await playerStatsModel.getOrCreatePlayerStats(user.telegramId, groupId)).stats;
    const finalStats = await applyPassiveRegen(user.telegramId, groupId, stats);
    const showcaseItems = await showcaseModel.getShowcase(user.telegramId, groupId);
    await ctx.reply(renderProfile(user.displayName, finalStats, showcaseItems), {
      parse_mode: 'HTML', ...mainMenu(),
    });
  });

  // ---------- انتخاب «پروفایل» / «شخصیت» بعد از ریپلای ----------
  bot.action(/^view:([pc]):(\d+):(\d+)$/, async (ctx) => {
    const [, kind, targetIdRaw, requesterRaw] = ctx.match;
    if (!ctx.state.isGroup) return ctx.answerCbQuery().catch(() => {});
    if (Number(requesterRaw) !== ctx.from.id) {
      return ctx.answerCbQuery('این دکمه برای کسی است که اریس را صدا زده.', { show_alert: true });
    }
    await ctx.answerCbQuery().catch(() => {});
    const { groupId } = ctx.state;
    const target = await userModel.getUser(Number(targetIdRaw));
    if (!target) return ctx.reply('⚠️ این کاربر پیدا نشد.');
    const threadId = getThreadId(ctx);
    const botUsername = await botUsernameOf(ctx.telegram, ctx.botInfo);
    await ctx.deleteMessage().catch(() => {});

    if (kind === 'c') {
      return characterCommand.showCharacter(ctx.telegram, {
        chatId: ctx.chat.id, groupId, threadId, target,
        requester: { telegram_id: ctx.from.id }, tag: true, botUsername,
      });
    }
    const tag = target.username ? `@${escapeHtml(target.username)}` : characterCommand.mention(target);
    try {
      return await profileCardService.sendProfileCard(
        ctx.telegram, ctx.chat.id,
        { telegramId: target.telegram_id, groupId, displayName: target.display_name, username: target.username },
        { autoDelete: true, extra: { caption: `👤 <b>پروفایل</b> ${tag}`, parse_mode: 'HTML', ...threadExtra(threadId) } }
      );
    } catch (err) {
      if (!/no stats row/.test(String(err.message))) console.error('[eris-view] profile failed:', err);
      return ctx.reply(`⚠️ ${characterCommand.mention(target)} هنوز در این گروه پروفایلی ندارد.`, { parse_mode: 'HTML' });
    }
  });

  // ---------- دکمه‌های پنل «اریس» ----------
  bot.action('eris:pve', async (ctx) => {
    const { user, groupId } = ctx.state;
    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.answerCbQuery('⚔️ شما در حال حاضر یک نبرد فعال دارید.', { show_alert: true });
    }
    await ctx.answerCbQuery();
    await ctx.reply('🏋️ <b>نبرد تمرینی با اریس</b>\n\nسطح سختی را انتخاب کنید:', {
      parse_mode: 'HTML', ...difficultyKeyboard(),
    });
  });

  bot.action('eris:team', async (ctx) => {
    const { user, groupId } = ctx.state;
    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.answerCbQuery('⚔️ شما در حال حاضر یک نبرد فعال دارید.', { show_alert: true });
    }
    const existingLobby = await mpModel.getRecruitingBattleForGroup(groupId, mpModel.TYPES.TEAM);
    if (existingLobby) {
      return ctx.answerCbQuery('⚔️ یک نبرد تیمی همین الان در حال جمع‌آوری نفرات است.', { show_alert: true });
    }
    await ctx.answerCbQuery();
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.TEAM, groupId, ctx.chat.id, user, ctx.state.threadId || 0);
  });

  bot.action('eris:ffa', async (ctx) => {
    const { user, groupId } = ctx.state;
    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.answerCbQuery('⚔️ شما در حال حاضر یک نبرد فعال دارید.', { show_alert: true });
    }
    const existingLobby = await mpModel.getRecruitingBattleForGroup(groupId, mpModel.TYPES.FFA);
    if (existingLobby) {
      return ctx.answerCbQuery('⚔️ یک نبرد آزاد همین الان در حال جمع‌آوری نفرات است.', { show_alert: true });
    }
    await ctx.answerCbQuery();
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.FFA, groupId, ctx.chat.id, user, ctx.state.threadId || 0);
  });
}

module.exports = { register };
