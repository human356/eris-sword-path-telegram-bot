'use strict';
const eventModel = require('../../database/models/eventModel');
const erisEventService = require('../../events/erisEventService');
const { progressBar } = require('../../utils/format');
const { erisEventKeyboard } = require('../keyboards');
function register(bot) {
  bot.command('event', async (ctx) => {
    if (!ctx.state.isGroup) return;

    const event = await eventModel.getActiveEvent(ctx.state.groupId);

    if (!event) {
      return ctx.reply(
        '😐 در حال حاضر هیچ چالش اریس فعالی وجود ندارد. به مبارزه ادامه دهید تا نوار خشم افزایش پیدا کند!'
      );
    }

    const remainingMs = new Date(event.ends_at).getTime() - Date.now();
    const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));

    await ctx.reply(
      `⚔️ <b>چالش اریس — فعال</b>\n\n⏱ ${remainingMin} دقیقه باقی‌مانده.\n\nبرای استفاده از تنها فرصت خود، دکمهٔ زیر را بزنید!`,
      { parse_mode: 'HTML', ...erisEventKeyboard(event.id) }
    );
  });

  bot.action(/^event:(\d+):attack$/, async (ctx) => {
    const eventId = Number(ctx.match[1]);
    const { groupId, user } = ctx.state;

    const result = await erisEventService.attack(
      groupId,
      user.telegramId
    );

    if (!result.success) {
      const messages = {
        NO_EVENT: 'در حال حاضر هیچ چالش اریس فعالی وجود ندارد.',
        EXPIRED: 'چالش همین الان به پایان رسید!',
        ALREADY_ATTEMPTED: 'شما قبلاً فرصت خود را در این چالش استفاده کرده‌اید.',
      };

      return ctx.answerCbQuery(
        messages[result.reason] || 'در حال حاضر امکان حمله وجود ندارد.',
        { show_alert: true }
      );
    }

    await ctx.answerCbQuery(
      `شما ${result.damage} آسیب به اریس وارد کردید!`,
      { show_alert: true }
    );
  });
}

module.exports = { register };