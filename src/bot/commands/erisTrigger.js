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

function erisPanelKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🏋️ مبارزه تمرینی با اریس', 'eris:pve'),
      Markup.button.callback('👥 مبارزه تیمی', 'eris:team'),
      Markup.button.callback('🤺 مبارزه آزاد ۳ نفره', 'eris:ffa'),
    ],
    [
      Markup.button.callback('🎯 نمرین', 'menu:training'),
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
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.TEAM, groupId, ctx.chat.id, user);
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
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.FFA, groupId, ctx.chat.id, user);
  });
}

module.exports = { register };
