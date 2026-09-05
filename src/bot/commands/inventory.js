'use strict';

const { Markup } = require('telegraf');

const inventoryModel = require('../../database/models/inventoryModel');
const cardLoadoutModel = require('../../database/models/cardLoadoutModel');
const showcaseModel = require('../../database/models/showcaseModel');
const battleModel = require('../../database/models/battleModel');
const playerStatsModel = require('../../database/models/playerStatsModel');
const shopService = require('../../economy/shopService');
const consumableService = require('../../economy/consumableService');
const treasureChestService = require('../../economy/treasureChestService');
const { sendAutoDelete } = require('../../utils/messageCleanup');
const { getCardLabel } = require('../../utils/cardLabels');
const { num, escapeHtml } = require('../../utils/format');
const itemsCatalog = require('../../config/items.json');
const C = require('../../config/constants');

const BOT_USERNAME = process.env.BOT_USERNAME;


/* =========================================================
   DEEP LINK
========================================================= */

function getInventoryDeepLink(groupId) {
  if (!BOT_USERNAME) {
    throw new Error('BOT_USERNAME در ENV تنظیم نشده است.');
  }

  return `https://t.me/${BOT_USERNAME}?start=jib_${groupId}`;
}


/* =========================================================
   INVENTORY TEXT
========================================================= */

async function buildInventoryText(
  telegramId,
  groupId,
  displayName
) {
  console.log(
    `[INVENTORY] Loading inventory | user=${telegramId} | group=${groupId}`
  );

  const items = await inventoryModel.getInventory(
    telegramId,
    groupId
  );

  console.log(
    `[INVENTORY] Inventory loaded | items=${items?.length ?? 'unknown'}`
  );

  const loadout = await cardLoadoutModel.getLoadout(
    telegramId,
    groupId
  );

  console.log(
    `[INVENTORY] Loadout loaded | cards=${loadout?.length ?? 'unknown'}`
  );

  const showcase = await showcaseModel.getShowcase(telegramId, groupId);

  let text = `🎒 <b>جیب من</b>\n`;
  text += `👤 ${escapeHtml(displayName)}\n\n`;

  text += `<b>کارت‌های نبرد فعال (۵ خانه):</b>\n`;

  loadout.forEach((cardKey, i) => {
    text += `${i + 1}. ${getCardLabel(cardKey)}\n`;
  });

  text += `\n`;

  text += `<b>آیتم‌ها:</b>\n`;

  if (!items || items.length === 0) {
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

  // Phase 6: showcase slots — the ۳ decorative items shown on /profile.
  text += `<b>🎨 ویترین پروفایل (${C.PLAYER_SHOWCASE_SLOTS} خانه):</b>\n`;
  showcase.forEach((itemKey, i) => {
    const def = itemKey ? itemsCatalog[itemKey] : null;
    text += `${i + 1}. ${def ? `${def.emoji || '🎨'} ${def.label}` : '— خالی —'}\n`;
  });

  text += `\n`;

  text +=
    `<i>🔒 این بخش کاملاً خصوصی است — فقط شما آن را می‌بینید. ` +
    `مصرف/تعویض کارت فقط خارج از نبرد امکان‌پذیر است.</i>`;

  return {
    text,
    items,
    loadout,
    showcase,
  };
}


/* =========================================================
   HOME KEYBOARD
========================================================= */

function homeKeyboard(groupId, items) {
  const rows = [];

  for (const row of items || []) {
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

  // Phase 6: treasure chest opening — only offered while the player owns at
  // least one, and only openable here (never mid-battle, same as consumables).
  const chestRow = (items || []).find((row) => row.item_key === 'TREASURE_CHEST' && row.quantity > 0);
  if (chestRow) {
    rows.push([
      Markup.button.callback(
        `🎁 باز کردن صندوقچهٔ گنج (${chestRow.quantity})`,
        `jib:chest:${groupId}`
      ),
    ]);
  }

  rows.push([
    Markup.button.callback(
      '🃏 ویرایش کارت‌های نبرد',
      `jib:cards:${groupId}`
    ),
  ]);

  // Phase 6: showcase editor entry point.
  rows.push([
    Markup.button.callback(
      '🎨 ویرایش ویترین پروفایل',
      `jib:showcase:${groupId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}


/* =========================================================
   SLOT PICKER KEYBOARD (battle cards)
========================================================= */

function slotPickerKeyboard(groupId, loadout) {
  const rows = (loadout || []).map((cardKey, i) => [
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


/* =========================================================
   CARD CHOOSER KEYBOARD
========================================================= */

function cardChooserKeyboard(
  groupId,
  slot,
  ownedCards,
  currentCard
) {
  const rows = (ownedCards || []).map((cardKey) => [
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


/* =========================================================
   SHOWCASE SLOT PICKER KEYBOARD  (Phase 6)
========================================================= */

function showcaseSlotPickerKeyboard(groupId, showcase) {
  const rows = showcase.map((itemKey, i) => {
    const def = itemKey ? itemsCatalog[itemKey] : null;
    const label = def ? `${def.emoji || '🎨'} ${def.label}` : '— خالی —';
    return [
      Markup.button.callback(
        `خانه ${i + 1}: ${label}`,
        `jib:showcaseSlot:${groupId}:${i + 1}`
      ),
    ];
  });

  rows.push([
    Markup.button.callback(
      '🔙 بازگشت',
      `jib:home:${groupId}`
    ),
  ]);

  return Markup.inlineKeyboard(rows);
}


/* =========================================================
   SHOWCASE ITEM CHOOSER KEYBOARD  (Phase 6)
========================================================= */

function showcaseChooserKeyboard(groupId, slot, ownedDecorativeKeys, currentKey) {
  const rows = ownedDecorativeKeys.map((itemKey) => {
    const def = itemsCatalog[itemKey];
    return [
      Markup.button.callback(
        `${itemKey === currentKey ? '✅ ' : ''}${def.emoji || '🎨'} ${def.label}`,
        `jib:showcaseSet:${groupId}:${slot}:${itemKey}`
      ),
    ];
  });

  rows.push([
    Markup.button.callback('🗑 خالی کردن این خانه', `jib:showcaseSet:${groupId}:${slot}:NONE`),
  ]);
  rows.push([
    Markup.button.callback('🔙 بازگشت', `jib:showcase:${groupId}`),
  ]);

  return Markup.inlineKeyboard(rows);
}


/* =========================================================
   RENDER HOME
========================================================= */

async function renderHome(
  ctx,
  telegramId,
  groupId,
  displayName,
  { edit = false } = {}
) {
  console.log(
    `[INVENTORY] renderHome | user=${telegramId} | group=${groupId} | edit=${edit}`
  );

  const { text, items } = await buildInventoryText(
    telegramId,
    groupId,
    displayName
  );

  const keyboard = homeKeyboard(
    groupId,
    items
  );

  /*
   * اگر از داخل دکمه آمده‌ایم، پیام قبلی را ویرایش می‌کنیم.
   */
  if (edit) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });

      return;
    } catch (error) {
      console.log(
        '[INVENTORY] editMessageText failed:',
        error.message
      );

      /*
       * اگر ویرایش پیام ممکن نبود، یک پیام جدید می‌فرستیم.
       */
    }
  }

  /*
   * این قسمت برای /start jib_... در PV است.
   *
   * ctx.reply() بهتر از ctx.telegram.sendMessage()
   * است چون تلگرام خودش chat فعلی را مشخص می‌کند.
   */
  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...keyboard,
  });
}


/* =========================================================
   SHOW INVENTORY IN GROUP
========================================================= */

async function showInventory(ctx) {
  const { groupId } = ctx.state;

  const isCallback =
    ctx.updateType === 'callback_query';

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
    console.error(
      '[INVENTORY] Deep Link error:',
      error
    );

    const notice =
      '⚠️ امکان باز کردن «جیب من» وجود ندارد.\n' +
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


/* =========================================================
   HANDLE /START jib_...
========================================================= */

async function handleInventoryStart(
  ctx,
  payload
) {
  if (
    !payload ||
    !payload.startsWith('jib_')
  ) {
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

  const telegramId = ctx.from.id;

  const displayName =
    ctx.from.first_name ||
    ctx.from.username ||
    'بازیکن';

  console.log(
    `[INVENTORY] Deep Link received | user=${telegramId} | group=${groupId}`
  );

  try {
    await renderHome(
      ctx,
      telegramId,
      groupId,
      displayName
    );

    console.log(
      `[INVENTORY] Successfully opened | user=${telegramId} | group=${groupId}`
    );
  } catch (error) {
    console.error(
      '[INVENTORY] Failed to open inventory:'
    );

    console.error(error);

    /*
     * برای اینکه بفهمیم دقیقاً مشکل چیست،
     * خطای واقعی را فعلاً در پیام هم نمایش می‌دهیم.
     */
    const errorMessage =
      error?.message ||
      String(error);

    await ctx.reply(
      '⚠️ هنگام باز کردن «جیب من» مشکلی پیش آمد.\n\n' +
      `🔧 خطا: ${errorMessage}`
    );
  }

  return true;
}


/* =========================================================
   REGISTER
========================================================= */

function register(bot) {

  /* -------------------------------------------------------
     /inventory
     /jibeman
  ------------------------------------------------------- */

  bot.command(
    ['inventory', 'jibeman'],
    async (ctx) => {
      if (!ctx.state.isGroup) return;

      await showInventory(ctx);
    }
  );


  /* -------------------------------------------------------
     MENU INVENTORY
  ------------------------------------------------------- */

  bot.action(
    'menu:inventory',
    async (ctx) => {
      await showInventory(ctx);
    }
  );


  /* -------------------------------------------------------
     USE CONSUMABLE
  ------------------------------------------------------- */

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
          { show_alert: true }
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
          { show_alert: true }
        );
      }

      const effect =
        consumableService.computeEffect(
          itemKey
        );

      if (!effect) {
        return ctx.answerCbQuery(
          'این آیتم به‌صورت مستقیم قابل مصرف نیست.',
          { show_alert: true }
        );
      }

      const stats =
        (
          await playerStatsModel
            .getOrCreatePlayerStats(
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
        { show_alert: true }
      );

      await renderHome(
        ctx,
        telegramId,
        groupId,
        ctx.from.first_name ||
          ctx.from.username ||
          'بازیکن',
        { edit: true }
      );
    }
  );


  /* -------------------------------------------------------
     OPEN TREASURE CHEST  (Phase 6)
     Opens privately in DM ("جیب من فقط باز بشه"), but the result is
     announced in the group ("نتیجه تو گروه اعلام بشه") — auto-deleted like
     any other non-exempt group message, since it's a flex/announcement,
     not a battle/round/training result.
  ------------------------------------------------------- */

  bot.action(
    /^jib:chest:(-?\d+)$/,
    async (ctx) => {

      const groupId = Number(ctx.match[1]);
      const telegramId = ctx.from.id;

      const result = await treasureChestService.openChest(telegramId, groupId);

      if (!result.success) {
        return ctx.answerCbQuery(
          'شما هیچ صندوقچه‌ای در جیب خود ندارید. از /shop بخرید!',
          { show_alert: true }
        );
      }

      await ctx.answerCbQuery('🎁 صندوقچه باز شد! نتیجه پایین‌تر آمده.');

      const displayName =
        ctx.from.first_name ||
        ctx.from.username ||
        'بازیکن';

      const privateText =
        `🎁 <b>نتیجهٔ باز کردن صندوقچهٔ گنج</b>\n\n` +
        result.rewardLines.map((line, i) => `${i + 1}. ${line}`).join('\n');

      await ctx.replyPersist(privateText, { parse_mode: 'HTML' });

      const groupText =
        `🎁 <b>${escapeHtml(displayName)}</b> یک صندوقچهٔ گنج افسانه‌ای باز کرد و این جوایز را گرفت:\n\n` +
        result.rewardLines.join('\n');

      await sendAutoDelete(ctx.telegram, groupId, groupText, { parse_mode: 'HTML' }).catch(() => {});

      await renderHome(
        ctx,
        telegramId,
        groupId,
        displayName,
        { edit: true }
      );
    }
  );


  /* -------------------------------------------------------
     SHOWCASE: OPEN SLOT LIST  (Phase 6)
  ------------------------------------------------------- */

  bot.action(
    /^jib:showcase:(-?\d+)$/,
    async (ctx) => {

      const groupId = Number(ctx.match[1]);
      const telegramId = ctx.from.id;

      await ctx.answerCbQuery();

      const showcase = await showcaseModel.getShowcase(telegramId, groupId);

      const text =
        `🎨 <b>ویترین پروفایل</b>\n\n` +
        `این ${C.PLAYER_SHOWCASE_SLOTS} خانه در /profile شما به بقیهٔ گروه نمایش داده می‌شود. ` +
        `خانه‌ای که می‌خواهید تنظیم کنید را انتخاب کنید:`;

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...showcaseSlotPickerKeyboard(groupId, showcase),
      }).catch((error) => {
        console.error('[INVENTORY] Failed to show showcase slots:', error);
      });
    }
  );


  /* -------------------------------------------------------
     SHOWCASE: PICK SLOT -> LIST OWNED DECORATIVE ITEMS  (Phase 6)
  ------------------------------------------------------- */

  bot.action(
    /^jib:showcaseSlot:(-?\d+):([1-3])$/,
    async (ctx) => {

      const groupId = Number(ctx.match[1]);
      const slot = Number(ctx.match[2]);
      const telegramId = ctx.from.id;

      await ctx.answerCbQuery();

      const ownedItems = await inventoryModel.getInventory(telegramId, groupId);
      const ownedDecorativeKeys = ownedItems
        .filter((row) => {
          const def = itemsCatalog[row.item_key];
          return def && def.category === 'DECORATIVE' && row.quantity > 0;
        })
        .map((row) => row.item_key);

      const showcase = await showcaseModel.getShowcase(telegramId, groupId);
      const currentKey = showcase[slot - 1];

      if (ownedDecorativeKeys.length === 0) {
        await ctx.editMessageText(
          `🎨 هنوز هیچ آیتم تزئینی‌ای ندارید. از بخش «🎨 تزئینات این هفته» در /shop یا از صندوقچهٔ گنج می‌توانید تهیه کنید.`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', `jib:showcase:${groupId}`)]]),
          }
        ).catch(() => {});
        return;
      }

      const text = `🎨 خانه ${slot} — آیتم تزئینی مورد نظر را انتخاب کنید:`;

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...showcaseChooserKeyboard(groupId, slot, ownedDecorativeKeys, currentKey),
      }).catch((error) => {
        console.error('[INVENTORY] Failed to show showcase chooser:', error);
      });
    }
  );


  /* -------------------------------------------------------
     SHOWCASE: SET SLOT  (Phase 6)
  ------------------------------------------------------- */

  bot.action(
    /^jib:showcaseSet:(-?\d+):([1-3]):([A-Z_]+|NONE)$/,
    async (ctx) => {

      const groupId = Number(ctx.match[1]);
      const slot = Number(ctx.match[2]);
      const rawKey = ctx.match[3];
      const telegramId = ctx.from.id;

      if (rawKey !== 'NONE') {
        const owned = await inventoryModel.getItemQuantity(telegramId, groupId, rawKey);
        if (owned <= 0) {
          return ctx.answerCbQuery('شما این آیتم را ندارید.', { show_alert: true });
        }
      }

      await showcaseModel.setSlot(telegramId, groupId, slot, rawKey === 'NONE' ? null : rawKey);

      await ctx.answerCbQuery(rawKey === 'NONE' ? '✅ خانه خالی شد.' : '✅ ویترین به‌روزرسانی شد!');

      const showcase = await showcaseModel.getShowcase(telegramId, groupId);
      const text =
        `🎨 <b>ویترین پروفایل</b>\n\n` +
        `این ${C.PLAYER_SHOWCASE_SLOTS} خانه در /profile شما به بقیهٔ گروه نمایش داده می‌شود. ` +
        `خانه‌ای که می‌خواهید تنظیم کنید را انتخاب کنید:`;

      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...showcaseSlotPickerKeyboard(groupId, showcase),
      }).catch((error) => {
        console.error('[INVENTORY] Failed to refresh showcase slots:', error);
      });
    }
  );


  /* -------------------------------------------------------
     EDIT CARDS
  ------------------------------------------------------- */

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

      await ctx.editMessageText(
        text,
        {
          parse_mode: 'HTML',
          ...slotPickerKeyboard(
            groupId,
            loadout
          ),
        }
      ).catch((error) => {
        console.error(
          '[INVENTORY] Failed to show card slots:',
          error
        );
      });
    }
  );


  /* -------------------------------------------------------
     BACK TO HOME
  ------------------------------------------------------- */

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
        { edit: true }
      );
    }
  );


  /* -------------------------------------------------------
     PICK CARD SLOT
  ------------------------------------------------------- */

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

      await ctx.editMessageText(
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
      ).catch((error) => {
        console.error(
          '[INVENTORY] Failed to show card chooser:',
          error
        );
      });
    }
  );


  /* -------------------------------------------------------
     SET CARD
  ------------------------------------------------------- */

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
          { show_alert: true }
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
          { show_alert: true }
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

      await ctx.editMessageText(
        text,
        {
          parse_mode: 'HTML',
          ...slotPickerKeyboard(
            groupId,
            loadout
          ),
        }
      ).catch((error) => {
        console.error(
          '[INVENTORY] Failed to refresh card slots:',
          error
        );
      });
    }
  );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  register,
  handleInventoryStart,
};
