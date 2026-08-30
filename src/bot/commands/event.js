'use strict';
const eventModel = require('../../database/models/eventModel');
const erisEventService = require('../../events/erisEventService');
const { progressBar } = require('../../utils/format');
const { erisEventKeyboard } = require('../keyboards');

function register(bot) {
  bot.command('event', async (ctx) => {
    if (!ctx.state.isGroup) return;
    const event = await eventModel.getActiveEvent(ctx.state.groupId);
    if (!event) return ctx.reply('😐 No Eris Challenge is active right now. Keep fighting to raise the Rage meter!');

    const remainingMs = new Date(event.ends_at).getTime() - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));
    await ctx.reply(
      `⚔️ <b>ERIS CHALLENGE — ACTIVE</b>\n\n⏱ ${remainingMin} minute(s) remaining.\n\nHit the button below for your one attempt!`,
      { parse_mode: 'HTML', ...erisEventKeyboard(event.id) }
    );
  });

  bot.action(/^event:(\d+):attack$/, async (ctx) => {
    const eventId = Number(ctx.match[1]);
    const { groupId, user } = ctx.state;

    const result = await erisEventService.attack(groupId, user.telegramId);
    if (!result.success) {
      const messages = {
        NO_EVENT: 'There is no active Eris Challenge right now.',
        EXPIRED: 'The challenge just ended!',
        ALREADY_ATTEMPTED: 'You already used your attempt for this challenge!',
      };
      return ctx.answerCbQuery(messages[result.reason] || 'Could not attack right now.', { show_alert: true });
    }

    await ctx.answerCbQuery(`You dealt ${result.damage} damage to Eris!`, { show_alert: true });
  });
}

module.exports = { register };
