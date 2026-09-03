'use strict';
const { Markup } = require('telegraf');
const inventoryModel = require('../../database/models/inventoryModel');
const cardLoadoutModel = require('../../database/models/cardLoadoutModel');
const battleModel = require('../../database/models/battleModel');
const playerStatsModel = require('../../database/models/playerStatsModel');
const shopService = require('../../economy/shopService');
const consumableService = require('../../economy/consumableService');
const { getCardLabel } = require('../../utils/cardLabels');
const { num, escapeHtml } = require('../../utils/format');

async function buildInventoryText(telegramId, groupId, displayName) {
  const items = await inventoryModel.getInventory(telegramId, groupId);
  const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);

  let text = `🎒 <b>جیب من</b>\n👤 ${escapeHtml(displayName)}\n\n`;

  text += `<b>کارت‌های نبرد فعال (۵ خانه):</b>\n`;
  loadout.forEach((cardKey, i) => {
    text += `${i + 1}. ${getCardLabel(cardKey)}\n`;
  });
  text += `\n`;

  text += `<b>آیتم‌ها:</b>\n`;
  if (items.length === 0) {
    text += `چیزی در جیب شما نیست. از /shop خرید کنید!`;
  } else {
    for (const row of items) {
      const def = shopService.getItemDef(row.item_key);
      text += `${def ? def.emoji : '📦'} ${def ? def.label : row.item_key}: ${num(row.quantity)} عدد\n`;
    }
  }

  text += `\n<i>🔒 این بخش کاملاً خصوصی است — فقط شما آن را می‌بینید. مصرف/تعویض کارت فقط خارج از نبرد امکان‌پذیر است.</i>`;
  return { text, items, loadout };
}

function homeKeyboard(groupId, items) {
  const rows = [];
  for (const row of items) {
    const def = shopService.getItemDef(row.item_key);
    if (def && def.category === 'CONSUMABLE' && def.usableOutOfBattle && row.quantity > 0) {
      rows.push([
        Markup.button.callback(
          `${def.emoji || '📦'} مصرف ${def.label} (${row.quantity})`,
          `jib:use:${row.item_key}:${groupId}`
        ),
      ]);
    }
  }
  rows.push([Markup.button.callback('🃏 ویرایش کارت‌های نبرد', `jib:cards:${groupId}`)]);
  return Markup.inlineKeyboard(rows);
}

function slotPickerKeyboard(groupId, loadout) {
  const rows = loadout.map((cardKey, i) => [
    Markup.button.callback(`خانه ${i + 1}: ${getCardLabel(cardKey)}`, `jib:pick:${groupId}:${i + 1}`),
  ]);
  rows.push([Markup.button.callback('🔙 بازگشت', `jib:home:${groupId}`)]);
  return Markup.inlineKeyboard(rows);
}

function cardChooserKeyboard(groupId, slot, ownedCards, currentCard) {
  const rows = ownedCards.map((cardKey) => [
    Markup.button.callback(
      `${cardKey === currentCard ? '✅ ' : ''}${getCardLabel(cardKey)}`,
      `jib:set:${groupId}:${slot}:${cardKey}`
    ),
  ]);
  rows.push([Markup.button.callback('🔙 بازگشت', `jib:cards:${groupId}`)]);
  return Markup.inlineKeyboard(rows);
}

async function renderHome(ctx, telegramId, groupId, displayName, { edit } = {}) {
  const { text, items } = await buildInventoryText(telegramId, groupId, displayName);
  const keyboard = homeKeyboard(groupId, items);
  if (edit) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard }).catch(() =>
      ctx.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML', ...keyboard })
    );
  } else {
    await ctx.telegram.sendMessage(telegramId, text, { parse_mode: 'HTML', ...keyboard });
  }
}

async function showInventory(ctx) {
  const { user, groupId } = ctx.state;
  const isCallback = ctx.updateType === 'callback_query';
  const isPrivate = ctx.chat && ctx.chat.type === 'private';

  try {
    // اگر در پیوی است، مستقیم نمایش بده
    if (isPrivate) {
      await renderHome(ctx, user.telegramId, groupId, user.displayName, { edit: false });
      if (isCallback) {
        await ctx.answerCbQuery('✅');
      }
      return;
    }

    // اگر در گروه است، دکمه برای رفتن به پیوی بفرست
    // 🔑 کلید: استفاده از callback button + دستور /jib در پیوی
    const inventoryKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          '🎒 باز کردن جیب من',
          `jib:open:${groupId}`
        )
      ]
    ]);

    await ctx.reply(
      `📩 برای مشاهدهٔ جیب خصوصی خود، روی دکمهٔ زیر کلیک کنید:\n\n` +
      `(یا دستور <code>/jib</code> را در پیوی ربات بفرستید)`,
      {
        parse_mode: 'HTML',
        ...inventoryKeyboard
      }
    );

    if (isCallback) {
      await ctx.answerCbQuery('📩 جیب شما در پیوی باز شد.');
    }
  } catch (err) {
    console.error('[inventory] error:', err);
    if (isCallback) {
      await ctx.answerCbQuery('❌ خطایی رخ داد', { show_alert: true });
    } else {
      await ctx.reply('❌ خطایی رخ داد');
    }
  }
}

function register(bot) {
  // دستور /jib برای استفاده در پیوی
  bot.command('jib', async (ctx) => {
    const isPrivate = ctx.chat && ctx.chat.type === 'private';
    if (!isPrivate) {
      return ctx.reply('🔒 این دستور فقط در پیوی ربات کار می‌کند.');
    }

    const { user } = ctx.state;
    
    let groupId = null;

    // ۱. اگر start parameter دارد (مثل /start jib_-1001234567)
    if (ctx.startPayload && ctx.startPayload.startsWith('jib_')) {
      groupId = ctx.startPayload.slice(4);
    }

    // ۲. فالبک: اگر groupId نداریم، از آخرین گروه فعال استفاده کن
    if (!groupId) {
      const { query } = require('../../database/pool');
      const { rows } = await query(
        `SELECT DISTINCT group_id FROM player_group_stats 
         WHERE telegram_id = $1 ORDER BY id DESC LIMIT 1`,
        [user.telegramId]
      );
      if (rows[0]) {
        groupId = rows[0].group_id;
      } else {
        return ctx.reply('❌ شما در هیچ گروهی جیب ندارید.\n\nابتدا به گروهی که ربات فعال است بپیوندید و یک دوئل انجام دهید.');
      }
    }

    try {
      await renderHome(ctx, user.telegramId, groupId, user.displayName, { edit: false });
    } catch (err) {
      console.error('[jib command] error:', err);
      await ctx.reply('❌ خطایی رخ داد');
    }
  });

  // دکمهٔ "باز کردن جیب من" در گروه — یک پیام به پیوی ارسال می‌کند
  bot.action(/^jib:open:(-?\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const telegramId = ctx.state.user.telegramId;
    
    try {
      await ctx.answerCbQuery('📩 جیب شما در پیوی باز می‌شود...');
      
      // به صورت مستقیم جیب را در پیوی بفرست
      await renderHome(ctx, telegramId, groupId, ctx.state.user.displayName, { edit: false });
    } catch (err) {
      console.error('[jib:open] error:', err);
      await ctx.answerCbQuery(
        '⚠️ برای مشاهدهٔ «جیب من» باید اول ربات را در پیوی استارت کنید.\n\nروی نام ربات کلیک کنید و /start را بفرستید.',
        { show_alert: true }
      );
    }
  });

  bot.command(['inventory', 'jibeman'], async (ctx) => {
    if (!ctx.state.isGroup) return;
    await showInventory(ctx);
  });

  bot.action('menu:inventory', async (ctx) => {
    await showInventory(ctx);
  });

  // ---- Everything below runs over DM (private callback queries) ----

  // مصرف آیتم در پیوی
  bot.action(/^jib:use:([A-Z_]+):(-?\d+)$/, async (ctx) => {
    const itemKey = ctx.match[1];
    const groupId = Number(ctx.match[2]);
    const telegramId = ctx.state.user.telegramId;

    const activeBattle = await battleModel.getActiveBattleForUser(groupId, telegramId);
    if (activeBattle) {
      return ctx.answerCbQuery('در حین نبرد باید آیتم را از همان‌جای مبارزه مصرف کنید.', { show_alert: true });
    }

    const qty = await inventoryModel.getItemQuantity(telegramId, groupId, itemKey);
    if (qty <= 0) return ctx.answerCbQuery('از این آیتم چیزی در جیب خود ندارید.', { show_alert: true });

    const effect = consumableService.computeEffect(itemKey);
    if (!effect) return ctx.answerCbQuery('این آیتم به‌صورت مستقیم قابل مصرف نیست.', { show_alert: true });

    const stats = (await playerStatsModel.getOrCreatePlayerStats(telegramId, groupId)).stats;
    await inventoryModel.removeItem(telegramId, groupId, itemKey, 1);

    const patch = effect.stat === 'stamina'
      ? { stamina: Math.min(stats.max_stamina, stats.stamina + effect.amount) }
      : { hp: Math.min(stats.max_hp, stats.hp + effect.amount) };
    await playerStatsModel.updatePlayerStats(telegramId, groupId, patch);

    await ctx.answerCbQuery(`✅ مصرف شد: ${effect.label}`, { show_alert: true });
    await renderHome(ctx, telegramId, groupId, ctx.state.user.displayName, { edit: true });
  });

  // ویرایش کارت‌ها
  bot.action(/^jib:cards:(-?\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const telegramId = ctx.state.user.telegramId;
    await ctx.answerCbQuery();

    const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);
    const text = `🃏 <b>ویرایش کارت‌های نبرد</b>\n\nخانه‌ای که می‌خواهید عوض کنید را انتخاب کنید:`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...slotPickerKeyboard(groupId, loadout) }).catch(() => {});
  });

  // بازگشت به خانه
  bot.action(/^jib:home:(-?\d+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    await ctx.answerCbQuery();
    await renderHome(ctx, ctx.state.user.telegramId, groupId, ctx.state.user.displayName, { edit: true });
  });

  // انتخاب خانه برای تغییر کارت
  bot.action(/^jib:pick:(-?\d+):([1-5])$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const slot = Number(ctx.match[2]);
    const telegramId = ctx.state.user.telegramId;
    await ctx.answerCbQuery();

    const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);
    const owned = await cardLoadoutModel.getOwnedCardKeys(telegramId, groupId);
    const text = `🃏 خانه ${slot} — کارت مورد نظر را انتخاب کنید:`;
    await ctx.editMessageText(
      text, { parse_mode: 'HTML', ...cardChooserKeyboard(groupId, slot, owned, loadout[slot - 1]) }
    ).catch(() => {});
  });

  // تنظیم کارت جدید
  bot.action(/^jib:set:(-?\d+):([1-5]):([A-Z_]+)$/, async (ctx) => {
    const groupId = Number(ctx.match[1]);
    const slot = Number(ctx.match[2]);
    const cardKey = ctx.match[3];
    const telegramId = ctx.state.user.telegramId;

    const activeBattle = await battleModel.getActiveBattleForUser(groupId, telegramId);
    if (activeBattle) {
      return ctx.answerCbQuery('در حین نبرد نمی‌توانید کارت‌ها را تغییر دهید. اول دوئل را تمام کنید.', { show_alert: true });
    }

    const owned = await cardLoadoutModel.getOwnedCardKeys(telegramId, groupId);
    if (!owned.includes(cardKey)) {
      return ctx.answerCbQuery('شما این کارت را ندارید.', { show_alert: true });
    }

    await cardLoadoutModel.setSlot(telegramId, groupId, slot, cardKey);
    await ctx.answerCbQuery('✅ کارت به‌روزرسانی شد!');

    const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);
    const text = `🃏 <b>ویرایش کارت‌های نبرد</b>\n\nخانه‌ای که می‌خواهید عوض کنید را انتخاب کنید:`;
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...slotPickerKeyboard(groupId, loadout) }).catch(() => {});
  });
}

module.exports = { register };
