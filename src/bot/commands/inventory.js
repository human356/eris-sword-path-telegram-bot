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

/**
 * نام کاربری ربات از ENV
 *
 * مثال:
 * BOT_USERNAME=MyGameBot
 *
 * بدون @
 */
const BOT_USERNAME = process.env.BOT_USERNAME;

/**
 * Deep Link مخصوص جیب من
 *
 * https://t.me/BOT_USERNAME?start=jib_GROUP_ID
 */
function getInventoryDeepLink(groupId) {
  if (!BOT_USERNAME) {
    throw new Error('BOT_USERNAME در ENV تنظیم نشده است.');
  }

  return `https://t.me/${BOT_USERNAME}?start=jib_${groupId}`;
}

async function buildInventoryText(telegramId, groupId, displayName) {
  const items = await inventoryModel.getInventory(telegramId, groupId);
  const loadout = await cardLoadoutModel.getLoadout(telegramId, groupId);

  let text = `🎒 <b>جیب من</b>\n`;
  text += `👤 ${escapeHtml(displayName)}\n\n`;

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

      text += `${def ? def.emoji : '📦'} `;
      text += `${def ? def.label : row.item_key}: `;
      text += `${num(row.quantity)} عدد\n`;
    }
  }

  text += `\n`;
  text += `<i>🔒 این بخش کاملاً خصوصی است — فقط شما آن را می‌بینید. مصرف/تعویض کارت فقط خارج از نبرد امکان‌پذیر است.</i>`;

  return {
    text,
    items,
    loadout,
  };
}

function homeKeyboard(groupId, items) {
  const rows = [];

  for (const row of items) {
    const def = shopService.getItemDef(row.item_key);

    if (
      def &&
      def.category === 'CONSUMABLE' &&
      def.usableOutOfBattle &&
      row.quantity > 0
    ) {
      rows.push([
        Markup.button.callback(
          `${def.emoji || '📦'} مصرف ${def.label} (${row.quantity})`,
          `jib:use:${row.item_key}:${groupId}`
        ),
      ]);
    }
  }

  rows.push([
    Markup.button.callback(
      '🃏 ویرایش کارت‌های نبرد',
      `jib:cards:${groupId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

function slotPickerKeyboard(groupId, loadout) {
  const rows = loadout.map((cardKey, i) => [
    Markup.button.callback(
      `خانه ${i + 1}: ${getCardLabel(cardKey)}`,
      `jib:pick:${groupId}:${i + 1}`
    ),
  ]);

  rows.push([
    Markup.button.callback(
      '🔙 بازگشت',
      `jib:home:${groupId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

function cardChooserKeyboard(groupId, slot, ownedCards, currentCard) {
  const rows = ownedCards.map((cardKey) => [
    Markup.button.callback(
      `${cardKey === currentCard ? '✅ ' : ''}${getCardLabel(cardKey)}`,
      `jib:set:${groupId}:${slot}:${cardKey}`
    ),
  ]);

  rows.push([
    Markup.button.callback(
      '🔙 بازگشت',
      `jib:cards:${groupId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}

async function renderHome(
  ctx,
  telegramId,
  groupId,
  displayName,
  { edit = false } = {}
) {
  const { text, items } = await buildInventoryText(
    telegramId,
    groupId,
    displayName
  );

  const keyboard = homeKeyboard(groupId, items);

  if (edit) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch {
      await ctx.telegram.sendMessage(
        telegramId,
        text,
        {
          parse_mode: 'HTML',
          ...keyboard,
        }
      );
    }

    return;
  }

  await ctx.telegram.sendMessage(
    telegramId,
    text,
    {
      parse_mode: 'HTML',
      ...keyboard,
    }
  );
}


/**
 * وقتی کاربر از داخل گروه روی «جیب من» می‌زند.
 *
 * دیگر مستقیماً تلاش نمی‌کنیم به PV پیام بفرستیم.
 * به‌جایش یک Deep Link می‌سازیم.
 */
async function showInventory(ctx) {
  const { user, groupId } = ctx.state;
  const isCallback = ctx.updateType === 'callback_query';

  try {
    const link = getInventoryDeepLink(groupId);

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url(
          '🎒 باز کردن «جیب من» در پیوی',
          link
        ),
      ],
    ]);

    const message =
      `🎒 <b>جیب من</b>\n\n` +
      `برای حفظ حریم خصوصی، موجودی شما در پیوی ربات نمایش داده می‌شود.\n\n` +
      `👇 روی دکمه زیر بزنید تا جیب شما باز شود.`;

    if (isCallback) {
      await ctx.answerCbQuery();

      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (error) {
    console.error('[INVENTORY] Deep Link error:', error);

    const notice =
      '⚠️ امکان باز کردن «جیب من» وجود ندارد. ' +
      'لطفاً تنظیمات BOT_USERNAME را بررسی کنید.';

    if (isCallback) {
      await ctx.answerCbQuery(notice, {
        show_alert: true,
      });
    } else {
      await ctx.reply(notice);
    }
  }
}


/**
 * این تابع را از هندلر /start اصلی صدا می‌زنیم.
 *
 * payload:
 * jib_-100123456789
 */
async function handleInventoryStart(ctx, payload) {
  if (!payload || !payload.startsWith('jib_')) {
    return false;
  }

  const groupIdString = payload.slice(4);
  const groupId = Number(groupIdString);

  if (!Number.isSafeInteger(groupId)) {
    await ctx.reply(
      '⚠️ لینک «جیب من» نامعتبر است.'
    );

    return true;
  }

  /**
   * بسیار مهم:
   *
   * اینجا telegramId را از خود PV می‌گیریم،
   * نه از گروه.
   */
  const telegramId = ctx.from.id;

  const displayName =
    ctx.from.first_name ||
    ctx.from.username ||
    'بازیکن';

  try {
async function renderHome(
  ctx,
  telegramId,
  groupId,
  displayName,
  { edit = false } = {}
) {
  const { text, items } = await buildInventoryText(
    telegramId,
    groupId,
    displayName
  );

  const keyboard = homeKeyboard(groupId, items);

  // اگر از داخل یک پیام PV ویرایش می‌کنیم
  if (edit) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });

      return;
    } catch (error) {
      console.log(
        '[INVENTORY] editMessageText failed, sending new message:',
        error.message
      );
    }
  }

  // پیام جدید را مستقیماً در چت فعلی ارسال کن
  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...keyboard,
  });
}
  return true;
}


function register(bot) {
  // =========================================================
  // GROUP
  // =========================================================

  bot.command(
    ['inventory', 'jibeman'],
    async (ctx) => {
      if (!ctx.state.isGroup) return;

      await showInventory(ctx);
    }
  );

  bot.action(
    'menu:inventory',
    async (ctx) => {
      await showInventory(ctx);
    }
  );


  // =========================================================
  // PRIVATE CALLBACKS
  // =========================================================

  // مصرف آیتم
  bot.action(
    /^jib:use:([A-Z_]+):(-?\d+)$/,
    async (ctx) => {
      const itemKey = ctx.match[1];
      const groupId = Number(ctx.match[2]);
      const telegramId = ctx.from.id;

      const activeBattle =
        await battleModel.getActiveBattleForUser(
          groupId,
          telegramId
        );

      if (activeBattle) {
        return ctx.answerCbQuery(
          'در حین نبرد باید آیتم را از همان‌جای مبارزه مصرف کنید.',
          {
            show_alert: true,
          }
        );
      }

      const qty =
        await inventoryModel.getItemQuantity(
          telegramId,
          groupId,
          itemKey
        );

      if (qty <= 0) {
        return ctx.answerCbQuery(
          'از این آیتم چیزی در جیب خود ندارید.',
          {
            show_alert: true,
          }
        );
      }

      const effect =
        consumableService.computeEffect(itemKey);

      if (!effect) {
        return ctx.answerCbQuery(
          'این آیتم به‌صورت مستقیم قابل مصرف نیست.',
          {
            show_alert: true,
          }
        );
      }

      const stats =
        (
          await playerStatsModel.getOrCreatePlayerStats(
            telegramId,
            groupId
          )
        ).stats;

      await inventoryModel.removeItem(
        telegramId,
        groupId,
        itemKey,
        1
      );

      const patch =
        effect.stat === 'stamina'
          ? {
              stamina: Math.min(
                stats.max_stamina,
                stats.stamina + effect.amount
              ),
            }
          : {
              hp: Math.min(
                stats.max_hp,
                stats.hp + effect.amount
              ),
            };

      await playerStatsModel.updatePlayerStats(
        telegramId,
        groupId,
        patch
      );

      await ctx.answerCbQuery(
        `✅ مصرف شد: ${effect.label}`,
        {
          show_alert: true,
        }
      );

      await renderHome(
        ctx,
        telegramId,
        groupId,
        ctx.from.first_name ||
          ctx.from.username ||
          'بازیکن',
        {
          edit: true,
        }
      );
    }
  );


  // =========================================================
  // CARD EDITOR
  // =========================================================

  bot.action(
    /^jib:cards:(-?\d+)$/,
    async (ctx) => {
      const groupId = Number(ctx.match[1]);
      const telegramId = ctx.from.id;

      await ctx.answerCbQuery();

      const loadout =
        await cardLoadoutModel.getLoadout(
          telegramId,
          groupId
        );

      const text =
        `🃏 <b>ویرایش کارت‌های نبرد</b>\n\n` +
        `خانه‌ای که می‌خواهید عوض کنید را انتخاب کنید:`;

      await ctx
        .editMessageText(
          text,
          {
            parse_mode: 'HTML',
            ...slotPickerKeyboard(
              groupId,
              loadout
            ),
          }
        )
        .catch(() => {});
    }
  );


  // بازگشت به جیب
  bot.action(
    /^jib:home:(-?\d+)$/,
    async (ctx) => {
      const groupId = Number(ctx.match[1]);

      await ctx.answerCbQuery();

      await renderHome(
        ctx,
        ctx.from.id,
        groupId,
        ctx.from.first_name ||
          ctx.from.username ||
          'بازیکن',
        {
          edit: true,
        }
      );
    }
  );


  // انتخاب خانه کارت
  bot.action(
    /^jib:pick:(-?\d+):([1-5])$/,
    async (ctx) => {
      const groupId = Number(ctx.match[1]);
      const slot = Number(ctx.match[2]);
      const telegramId = ctx.from.id;

      await ctx.answerCbQuery();

      const loadout =
        await cardLoadoutModel.getLoadout(
          telegramId,
          groupId
        );

      const owned =
        await cardLoadoutModel.getOwnedCardKeys(
          telegramId,
          groupId
        );

      const text =
        `🃏 خانه ${slot} — کارت مورد نظر را انتخاب کنید:`;

      await ctx
        .editMessageText(
          text,
          {
            parse_mode: 'HTML',
            ...cardChooserKeyboard(
              groupId,
              slot,
              owned,
              loadout[slot - 1]
            ),
          }
        )
        .catch(() => {});
    }
  );


  // تغییر کارت
  bot.action(
    /^jib:set:(-?\d+):([1-5]):([A-Z_]+)$/,
    async (ctx) => {
      const groupId = Number(ctx.match[1]);
      const slot = Number(ctx.match[2]);
      const cardKey = ctx.match[3];
      const telegramId = ctx.from.id;

      const activeBattle =
        await battleModel.getActiveBattleForUser(
          groupId,
          telegramId
        );

      if (activeBattle) {
        return ctx.answerCbQuery(
          'در حین نبرد نمی‌توانید کارت‌ها را تغییر دهید. اول دوئل را تمام کنید.',
          {
            show_alert: true,
          }
        );
      }

      const owned =
        await cardLoadoutModel.getOwnedCardKeys(
          telegramId,
          groupId
        );

      if (!owned.includes(cardKey)) {
        return ctx.answerCbQuery(
          'شما این کارت را ندارید.',
          {
            show_alert: true,
          }
        );
      }

      await cardLoadoutModel.setSlot(
        telegramId,
        groupId,
        slot,
        cardKey
      );

      await ctx.answerCbQuery(
        '✅ کارت به‌روزرسانی شد!'
      );

      const loadout =
        await cardLoadoutModel.getLoadout(
          telegramId,
          groupId
        );

      const text =
        `🃏 <b>ویرایش کارت‌های نبرد</b>\n\n` +
        `خانه‌ای که می‌خواهید عوض کنید را انتخاب کنید:`;

      await ctx
        .editMessageText(
          text,
          {
            parse_mode: 'HTML',
            ...slotPickerKeyboard(
              groupId,
              loadout
            ),
          }
        )
        .catch(() => {});
    }
  );
}


module.exports = {
  register,
  handleInventoryStart,
};
