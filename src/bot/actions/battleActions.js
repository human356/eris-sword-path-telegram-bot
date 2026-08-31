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

  // battle:<id>:move:<MOVE>
  bot.action(/^battle:(\d+):move:(ATTACK|GUARD|DODGE|HEAVY_ATTACK|COUNTER)$/, async (ctx) => {
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
      
        NO_STAMINA: 'استقامت کافی برای انجام این حرکت را ندارید!',
      
        ALREADY_MOVED: 'شما حرکت خود را در این راند انتخاب کرده‌اید.',
      
      };
      
      return ctx.answerCbQuery(
        messages[result.reason] || 'امکان ثبت این حرکت وجود ندارد.',
        { show_alert: true }
      );}

      await ctx.answerCbQuery(
        result.waitingForOpponent
          ? 'حرکت ثبت شد. منتظر حرکت حریف باشید...'
          : 'حرکت ثبت شد!'
      );  });
}

module.exports = { register };
