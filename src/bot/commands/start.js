'use strict';
const userModel = require('../../database/models/userModel');
const inventoryCommand = require('./inventory');
const privateShop = require('./privateShop');
const characterCommand = require('./character');

/**
 * Private /start (group /start is the profile command). Opening the bot in
 * private marks the player as "started", which unlocks the commands in groups
 * (see middlewares/startGate.js). Deep-link payloads:
 *   jib_<groupId>              -> «جیب من»
 *   buy_[<groupId>_]<ITEM_KEY> -> direct purchase
 *   char_<groupId>             -> button that opens the character Mini App
 */
function register(bot) {
  bot.start(async (ctx, next) => {
    if (ctx.state && ctx.state.isGroup) return next();

    await userModel.markStarted(ctx.from.id);
    if (ctx.state && ctx.state.user) ctx.state.user.started = true;

    const payload = (ctx.message && ctx.message.text ? ctx.message.text.split(/\s+/).slice(1).join(' ') : '').trim();

    if (payload.startsWith('jib_') && (await inventoryCommand.handleInventoryStart(ctx, payload))) return undefined;
    if (payload.startsWith('char_') && (await characterCommand.handleCharacterStart(ctx, payload))) return undefined;
    if (payload.startsWith('buy_') && (await privateShop.handleBuyStart(ctx, payload))) return undefined;

    const text =
      '⚔️ <b>به اریس — مسیر شمشیر خوش آمدید!</b>\n\n' +
      '✅ حالا می‌توانید در گروه‌ها از ربات استفاده کنید. داخل گروه /profile را بزنید تا پروفایل شمشیرتان ساخته شود.\n\n' +
      '🛒 برای دیدن فروشگاه، در متن‌باکس یک گروه بنویسید: <code>@' + ((ctx.botInfo && ctx.botInfo.username) || 'bot') + ' shop</code>';
    await ctx.reply(text, { parse_mode: 'HTML' });
    if (process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL) await characterCommand.sendOpenButton(ctx, null);
    return undefined;
  });
}

module.exports = { register };
