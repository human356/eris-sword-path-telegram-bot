'use strict';
const battleModel = require('../../database/models/battleModel');

function register(bot, battleManager) {
  // battle:<id>:accept | battle:<id>:decline
  bot.action(/^battle:(\d+):(accept|decline)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const action = ctx.match[2];
    const battle = await battleModel.getBattle(battleId);

    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_ACCEPT) {
      return ctx.answerCbQuery('این چالش دیگر در دسترس نیست.', { show_alert: true });
    }
    // Security (spec §28, §33): only the named opponent may accept/decline.
    if (ctx.from.id !== battle.opponent_id) {
      return ctx.answerCbQuery('فقط مبارزی که به چالش کشیده شده می‌تواند به این پاسخ دهد.', { show_alert: true });
    }

    if (action === 'accept') {
      await ctx.answerCbQuery('چالش پذیرفته شد!');
      await battleManager.acceptChallenge(battleId, ctx.chat.id);
    } else {
      await ctx.answerCbQuery('چالش رد شد.');
      await battleManager.declineChallenge(battleId, ctx.chat.id);
    }
  });

  // battle:<id>:move:<MOVE> — MOVE can be one of the 5 starter moves OR any
  // of the 9 Phase 4 special cards; battleManager validates it against the
  // presser's own equipped loadout.
  bot.action(/^battle:(\d+):move:([A-Z_]+)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const move = ctx.match[2];
    const battle = await battleModel.getBattle(battleId);

    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) {
      return ctx.answerCbQuery('این دور از مسابقات قبلاً تمام شده است.', { show_alert: true });
    }
    // Security (spec §33): the caller must actually be a participant of this battle.
    if (ctx.from.id !== battle.challenger_id && ctx.from.id !== battle.opponent_id) {
      return ctx.answerCbQuery('تو جزو این دوئل نیستی. سیک...', { show_alert: true });
    }

    const result = await battleManager.submitMove(battleId, ctx.from.id, move, ctx.chat.id);
    if (!result.accepted) {
      const messages = {
        NOT_ACTIVE: 'این راند به پایان رسیده است.',
        NOT_PARTICIPANT: 'شما در این دوئل حضور ندارید.',
        INVALID_MOVE: 'حرکت نامعتبر است.',
        NOT_EQUIPPED: 'این کارت در ۵ خانهٔ فعال شما نیست. از «جیب من» تنظیمش کنید.',
        NO_STAMINA: 'استقامت کافی برای انجام این حرکت را ندارید!',
        ALREADY_MOVED: 'شما حرکت خود را در این راند انتخاب کرده‌اید.',
        MOVE_LOCKED: 'این سبک را همین الان استفاده کردید — یک راند باید صبر کنید.',
        STUNNED: 'در اثر یک اثر ویژه، این راند نمی‌توانید کارتی انتخاب کنید.',
      };
      return ctx.answerCbQuery(
        messages[result.reason] || 'امکان ثبت این حرکت وجود ندارد.',
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery(
      result.waitingForOpponent
        ? 'حرکت ثبت شد. منتظر حرکت حریف باشید...'
        : 'حرکت ثبت شد!'
    );
  });

  // battle:<id>:item:<ITEM_KEY> — using an item is separate from picking a
  // move; a player can do both the same round (spec §3/§8).
  bot.action(/^battle:(\d+):item:([A-Z_]+)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const itemKey = ctx.match[2];

    const result = await battleManager.useItem(battleId, ctx.from.id, itemKey, ctx.chat.id);

    if (!result.accepted) {
      const messages = {
        NOT_ACTIVE: 'این راند به پایان رسیده است.',
        NOT_PARTICIPANT: 'شما در این دوئل حضور ندارید.',
        INVALID_ITEM: 'این آیتم در نبرد قابل استفاده نیست.',
        NO_ITEM: 'شما از این آیتم چیزی ندارید. از /shop خرید کنید.',
        HEAL_LOCKED_LATE_ROUND: 'در راند ۲۴ و ۲۵ نبرد، مصرف آیتم‌های درمانی مجاز نیست.',
      };
      return ctx.answerCbQuery(
        messages[result.reason] || 'مصرف آیتم انجام نشد.',
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery(`✅ مصرف شد: ${result.effect.label}`, { show_alert: true });
  });
}

module.exports = { register };
