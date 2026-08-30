'use strict';
const battleModel = require('../../database/models/battleModel');

function register(bot, battleManager) {
  // battle:<id>:accept | battle:<id>:decline
  bot.action(/^battle:(\d+):(accept|decline)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const action = ctx.match[2];
    const battle = await battleModel.getBattle(battleId);

    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_ACCEPT) {
      return ctx.answerCbQuery('This challenge is no longer available.', { show_alert: true });
    }
    // Security (spec §28, §33): only the named opponent may accept/decline.
    if (ctx.from.id !== battle.opponent_id) {
      return ctx.answerCbQuery('Only the challenged fighter can respond to this.', { show_alert: true });
    }

    if (action === 'accept') {
      await ctx.answerCbQuery('Challenge accepted!');
      await battleManager.acceptChallenge(battleId, ctx.chat.id);
    } else {
      await ctx.answerCbQuery('Challenge declined.');
      await battleManager.declineChallenge(battleId, ctx.chat.id);
    }
  });

  // battle:<id>:move:<MOVE>
  bot.action(/^battle:(\d+):move:(ATTACK|GUARD|DODGE|HEAVY_ATTACK|COUNTER)$/, async (ctx) => {
    const battleId = Number(ctx.match[1]);
    const move = ctx.match[2];
    const battle = await battleModel.getBattle(battleId);

    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) {
      return ctx.answerCbQuery('This round is already over.', { show_alert: true });
    }
    // Security (spec §33): the caller must actually be a participant of this battle.
    if (ctx.from.id !== battle.challenger_id && ctx.from.id !== battle.opponent_id) {
      return ctx.answerCbQuery('You are not part of this duel.', { show_alert: true });
    }

    const result = await battleManager.submitMove(battleId, ctx.from.id, move, ctx.chat.id);
    if (!result.accepted) {
      const messages = {
        NOT_ACTIVE: 'This round is already over.',
        NOT_PARTICIPANT: 'You are not part of this duel.',
        INVALID_MOVE: 'Unknown move.',
        NO_STAMINA: 'Not enough stamina for that move!',
        ALREADY_MOVED: 'You already locked in your move this round.',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'Could not register that move.', { show_alert: true });
    }

    await ctx.answerCbQuery(result.waitingForOpponent ? 'Move locked in. Waiting for opponent...' : 'Move locked in!');
  });
}

module.exports = { register };
