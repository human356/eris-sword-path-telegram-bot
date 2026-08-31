'use strict';
const { query } = require('../../database/pool');
const userModel = require('../../database/models/userModel');
const battleModel = require('../../database/models/battleModel');
const cooldownModel = require('../../database/models/cooldownModel');
const { displayNameOf } = require('../../utils/format');
const C = require('../../config/constants');

const FIGHT_COOLDOWN_ACTION = 'fight_request';

async function resolveOpponent(ctx) {
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.from &&
    !ctx.message.reply_to_message.from.is_bot
  ) {
    const from = ctx.message.reply_to_message.from;
    return {
      telegramId: from.id,
      displayName: displayNameOf(from),
      username: from.username
    };
  }

  const text = ctx.message.text || '';
  const match = text.match(/@(\w{4,})/);

  if (match) {
    const username = match[1];
    const { rows } = await query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (rows[0]) {
      return {
        telegramId: rows[0].telegram_id,
        displayName: rows[0].display_name,
        username: rows[0].username
      };
    }
  }

  return null;
}

function register(bot, battleManager) {
  bot.command('fight', async (ctx) => {
    if (!ctx.state.isGroup) return;

    const { user, groupId } = ctx.state;

    const remaining = await cooldownModel.getRemainingCooldown(
      user.telegramId,
      groupId,
      FIGHT_COOLDOWN_ACTION
    );

    if (remaining > 0) {
      return ctx.reply(
        `⏱ کمی آرام‌تر، شمشیرزن! ${remaining} ثانیه دیگر دوباره امتحان کن.`
      );
    }

    const opponent = await resolveOpponent(ctx);

    if (!opponent) {
      return ctx.reply(
        '⚔️ به پیام یک بازیکن با /fight پاسخ دهید، یا از /fight @username استفاده کنید.'
      );
    }

    if (opponent.telegramId === user.telegramId) {
      return ctx.reply(
        '⚔️ قهرمان، نمی‌توانی خودت را به مبارزه دعوت کنی!'
      );
    }

    const existingChallenger =
      await battleModel.getActiveBattleForUser(
        groupId,
        user.telegramId
      );

    if (existingChallenger) {
      return ctx.reply(
        '⚔️ شما در حال حاضر یک دوئل فعال دارید. ابتدا آن را به پایان برسانید!'
      );
    }

    const existingOpponent =
      await battleModel.getActiveBattleForUser(
        groupId,
        opponent.telegramId
      );

    if (existingOpponent) {
      return ctx.reply(
        '⚔️ این مبارز در حال حاضر در یک دوئل است.'
      );
    }

    await userModel.upsertUser({
      telegramId: opponent.telegramId,
      username: opponent.username,
      displayName: opponent.displayName,
    });

    await cooldownModel.setCooldown(
      user.telegramId,
      groupId,
      FIGHT_COOLDOWN_ACTION,
      C.FIGHT_COOLDOWN_SECONDS
    );

    await battleManager.startChallenge({
      groupId,
      challengerUser: user,
      opponentUser: opponent,
      chatId: ctx.chat.id,
    });
  });

  bot.action('menu:fight', async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      '⚔️ برای دعوت یک بازیکن، به پیام او با /fight پاسخ دهید، یا برای دعوت مستقیم از /fight @username استفاده کنید.'
    );
  });
}

module.exports = { register };