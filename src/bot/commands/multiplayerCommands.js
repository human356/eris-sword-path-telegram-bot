'use strict';
const battleModel = require('../../database/models/battleModel');
const mpModel = require('../../database/models/multiplayerBattleModel');
const { difficultyKeyboard } = require('../keyboardsMultiplayer');

async function hasAnyActiveBattle(groupId, telegramId) {
  const duel = await battleModel.getActiveBattleForUser(groupId, telegramId);
  if (duel) return true;
  const mp = await mpModel.getActiveBattleForUser(groupId, telegramId);
  return !!mp;
}

function register(bot, multiplayerBattleManager) {
  // ---------- /trainbattle (PvE) ----------
  bot.command(['trainbattle', 'pve'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    if (await hasAnyActiveBattle(ctx.state.groupId, ctx.state.user.telegramId)) {
      return ctx.reply('⚔️ شما در حال حاضر یک نبرد فعال دارید. ابتدا آن را تمام کنید.');
    }
    await ctx.reply('🏋️ <b>نبرد تمرینی با اریس</b>\n\nسطح سختی را انتخاب کنید:', { parse_mode: 'HTML', ...difficultyKeyboard() });
  });

  bot.action(/^pve:start:(EASY|MEDIUM|HARD)$/, async (ctx) => {
    const difficulty = ctx.match[1];
    const { user, groupId } = ctx.state;

    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.answerCbQuery('شما در حال حاضر یک نبرد فعال دارید.', { show_alert: true });
    }

    await ctx.answerCbQuery('نبرد شروع شد!');
    await multiplayerBattleManager.startPveBattle(groupId, ctx.chat.id, user, difficulty, ctx.state.threadId || 0);
  });

  // ---------- /teambattle ----------
  bot.command('teambattle', async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.reply('⚔️ شما در حال حاضر یک نبرد فعال دارید. ابتدا آن را تمام کنید.');
    }
    const existingLobby = await mpModel.getRecruitingBattleForGroup(groupId, mpModel.TYPES.TEAM);
    if (existingLobby) {
      return ctx.reply('⚔️ یک نبرد تیمی همین الان در حال جمع‌آوری نفرات است — از دکمهٔ آن پیوند بزنید.');
    }
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.TEAM, groupId, ctx.chat.id, user, ctx.state.threadId || 0);
  });

  // ---------- /freeforall ----------
  bot.command(['freeforall', 'ffa'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    const { user, groupId } = ctx.state;
    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.reply('⚔️ شما در حال حاضر یک نبرد فعال دارید. ابتدا آن را تمام کنید.');
    }
    const existingLobby = await mpModel.getRecruitingBattleForGroup(groupId, mpModel.TYPES.FFA);
    if (existingLobby) {
      return ctx.reply('⚔️ یک نبرد آزاد همین الان در حال جمع‌آوری نفرات است — از دکمهٔ آن بپیوندید.');
    }
    await multiplayerBattleManager.startRecruiting(mpModel.TYPES.FFA, groupId, ctx.chat.id, user, ctx.state.threadId || 0);
  });

  // ---------- Shared lobby actions ----------
  bot.action(/^mp:(\d+):join$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const { user, groupId } = ctx.state;

    if (await hasAnyActiveBattle(groupId, user.telegramId)) {
      return ctx.answerCbQuery('شما در حال حاضر یک نبرد فعال دارید.', { show_alert: true });
    }

    const result = await multiplayerBattleManager.joinBattle(battleId, user.telegramId, user.displayName, groupId, ctx.chat.id);
    if (!result.accepted) {
      const messages = {
        NOT_RECRUITING: 'این نبرد دیگر در حال جمع‌آوری نفرات نیست.',
        ALREADY_JOINED: 'شما قبلاً پیوسته‌اید.',
        FULL: 'ظرفیت این نبرد تکمیل شده است.',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'پیوستن ممکن نشد.', { show_alert: true });
    }
    await ctx.answerCbQuery('✅ پیوستید!');
  });

  bot.action(/^mp:(\d+):start$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const result = await multiplayerBattleManager.forceStart(battleId, ctx.from.id, ctx.chat.id);
    if (!result.accepted) {
      const messages = {
        NOT_RECRUITING: 'این نبرد دیگر در حال جمع‌آوری نفرات نیست.',
        NOT_INITIATOR: 'فقط کسی که این نبرد را باز کرده می‌تواند زودتر شروعش کند.',
        NOT_ENOUGH_PLAYERS: `حداقل ${result.minP || ''} نفر لازم است.`,
      };
      return ctx.answerCbQuery(messages[result.reason] || 'شروع ممکن نشد.', { show_alert: true });
    }
    await ctx.answerCbQuery('▶️ نبرد شروع شد!');
  });

  // ---------- Move submission: no-target (PVE / TEAM champions) ----------
  bot.action(/^mp:(\d+):move:([A-Z_]+)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const move = ctx.match[2];
    const result = await multiplayerBattleManager.submitMove(battleId, ctx.from.id, move, null, ctx.chat.id);
    await respondToMoveSubmission(ctx, result);
  });

  // ---------- Move submission: with target (FFA) ----------
  bot.action(/^mp:(\d+):move:([A-Z_]+):(\d+)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const move = ctx.match[2];
    const targetRaw = Number(ctx.match[3]);
    const target = targetRaw === 0 ? null : targetRaw;
    const result = await multiplayerBattleManager.submitMove(battleId, ctx.from.id, move, target, ctx.chat.id);
    await respondToMoveSubmission(ctx, result);
  });

  async function respondToMoveSubmission(ctx, result) {
    if (!result.accepted) {
      const messages = {
        NOT_ACTIVE: 'این راند به پایان رسیده است.',
        NOT_PARTICIPANT: 'شما در این نبرد حضور ندارید یا حذف شده‌اید.',
        NOT_YOUR_TURN: 'این راند نوبت شما نیست — منتظر بمانید.',
        INVALID_TARGET: 'نمی‌توانید خودتان را هدف بگیرید.',
        NOT_EQUIPPED: 'این کارت در ۵ خانهٔ فعال شما نیست.',
        MOVE_LOCKED: 'این سبک را همین الان استفاده کردید — یک راند صبر کنید.',
        NO_STAMINA: 'استقامت کافی ندارید.',
        ALREADY_MOVED: 'قبلاً حرکت خود را ثبت کرده‌اید.',
        INVALID_MOVE: 'حرکت نامعتبر است.',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'ثبت حرکت ممکن نشد.', { show_alert: true });
    }
    await ctx.answerCbQuery(result.waiting ? 'حرکت ثبت شد. منتظر بقیه باشید...' : 'حرکت ثبت شد!');
  }

  // ---------- Item usage ----------
  bot.action(/^mp:(\d+):item:([A-Z_]+)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const itemKey = ctx.match[2];
    const result = await multiplayerBattleManager.useItem(battleId, ctx.from.id, itemKey, ctx.chat.id);
    if (!result.accepted) {
      const messages = {
        NOT_ACTIVE: 'این راند به پایان رسیده است.',
        NOT_PARTICIPANT: 'شما در این نبرد حضور ندارید.',
        INVALID_ITEM: 'این آیتم در این نوع نبرد قابل استفاده نیست.',
        NO_ITEM: 'شما از این آیتم چیزی ندارید.',
        HEAL_LOCKED_LATE_ROUND: 'در راندهای پایانی، مصرف آیتم درمانی مجاز نیست.',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'مصرف آیتم ممکن نشد.', { show_alert: true });
    }
    await ctx.answerCbQuery(`✅ مصرف شد: ${result.effect.label}`, { show_alert: true });
  });
}

module.exports = { register };
