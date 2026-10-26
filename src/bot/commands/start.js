'use strict';
const userModel = require('../../database/models/userModel');
const inventoryCommand = require('./inventory');
const privateShop = require('./privateShop');

/**
 * Private /start (group /start is the profile command). Opening the bot in
 * private marks the player as "started", which unlocks the commands in groups
 * (see middlewares/startGate.js). Deep-link payloads:
 *   jib_<groupId>              -> «جیب من»
 *   buy_[<groupId>_]<ITEM_KEY> -> direct purchase
 */
function register(bot) {
  bot.start(async (ctx, next) => {
    if (ctx.state && ctx.state.isGroup) return next();

    await userModel.markStarted(ctx.from.id);
    if (ctx.state && ctx.state.user) ctx.state.user.started = true;

    const payload = (ctx.message && ctx.message.text ? ctx.message.text.split(/\s+/).slice(1).join(' ') : '').trim();

    if (payload.startsWith('jib_') && (await inventoryCommand.handleInventoryStart(ctx, payload))) return undefined;
    if (payload.startsWith('buy_') && (await privateShop.handleBuyStart(ctx, payload))) return undefined;

    const text =
      '⚔️ <b>به اریس — مسیر شمشیر خوش آمدید!</b>\n\n' +
      '✅ حالا می‌توانید در گروه‌ها از ربات استفاده کنید. داخل گروه /profile را بزنید تا پروفایل شمشیرتان ساخته شود.\n\n' +
      '🛒 برای دیدن فروشگاه، در متن‌باکس یک گروه بنویسید: <code>@' + ((ctx.botInfo && ctx.botInfo.username) || 'bot') + ' shop</code>';
    await ctx.reply(text, { parse_mode: 'HTML' });
    return undefined;
  });
}

module.exports = { register };
