'use strict';
const { Markup } = require('telegraf');
const env = require('../../config/env');
const slots = require('../../config/imageSlots');
const imageService = require('../../services/imageService');
const botImageModel = require('../../database/models/botImageModel');

/**
 * Super-admin ("ادمین مادر") image manager — private chat only.
 *   /admin  (or /images)  ->  menu of every configurable picture:
 *     🖼 profile templates · 🎁 product photos · 🆙 level-up photos · 🏪 shop banner
 * Pick a slot, then send the photo to the bot as a normal (compressed) photo.
 * The photo's Telegram file_id is stored (bot_images.source = 'admin') and wins
 * over any file shipped in /assets. Nothing is downloaded or re-uploaded.
 */
const PAGE_SIZE = 8;
const PENDING_TTL_MS = 10 * 60 * 1000;
const pending = new Map(); // adminId -> { type: 'photo', slotKey } | { type: 'level_number' }, at

const isAdmin = (ctx) => !!ctx.from && env.SUPER_ADMIN_IDS.includes(ctx.from.id);
const isPrivate = (ctx) => ctx.chat && ctx.chat.type === 'private';

function setPending(adminId, value) {
  pending.set(adminId, { ...value, at: Date.now() });
}
function getPending(adminId) {
  const p = pending.get(adminId);
  if (!p) return null;
  if (Date.now() - p.at > PENDING_TTL_MS) {
    pending.delete(adminId);
    return null;
  }
  return p;
}

const SOURCE_TEXT = { admin: '📤 ارسال‌شده توسط ادمین', asset: '📁 فایل پروژه (assets)' };

async function describe(slotKey) {
  const r = await imageService.resolve(slotKey);
  if (!r) return '— تنظیم نشده —';
  if (r.mode === 'source') return '📁 فایل پروژه (هنوز در تلگرام آپلود نشده)';
  return (r.row && SOURCE_TEXT[r.row.source]) || '✅ تنظیم شده';
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function mainMenu() {
  return {
    text:
      '🛠 <b>پنل عکس‌های ربات</b> (ادمین مادر)\n\n' +
      'برای هر بخش، عکس را همین‌جا در پیوی به ربات بفرستید تا ذخیره شود. ' +
      'عکس ارسالی ادمین بر فایل‌های پوشهٔ assets اولویت دارد.',
    keyboard: Markup.inlineKeyboard([
      [Markup.button.callback('🖼 قالب‌های پروفایل', 'adm:list:tpl:0')],
      [Markup.button.callback('🎁 عکس محصولات و آیتم‌ها', 'adm:list:item:0')],
      [Markup.button.callback('🆙 عکس ارتقای لول', 'adm:levels')],
      [Markup.button.callback('🏪 بنر فروشگاه هفتگی', 'adm:slot:shop:banner')],
      [Markup.button.callback('🏆 عکس‌های نتیجهٔ نبرد (اریس برنده/بازنده، پس‌زمینه)', 'adm:list:result:0')],
    ]),
  };
}

async function slotList(kind, page) {
  const all = kind === 'tpl' ? slots.listTemplateSlots() : kind === 'result' ? slots.listResultSlots() : slots.listItemSlots();
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const chunk = all.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  const rows = [];
  for (const s of chunk) {
    const r = await imageService.resolve(s.key);
    rows.push([Markup.button.callback(`${r ? '✅' : '⬜️'} ${s.label}`.slice(0, 60), `adm:slot:${s.key}`)]);
  }
  const nav = [];
  if (p > 0) nav.push(Markup.button.callback('◀️', `adm:list:${kind}:${p - 1}`));
  nav.push(Markup.button.callback(`${p + 1}/${pages}`, 'adm:noop'));
  if (p < pages - 1) nav.push(Markup.button.callback('▶️', `adm:list:${kind}:${p + 1}`));
  rows.push(nav);
  rows.push([Markup.button.callback('🔙 منوی اصلی', 'adm:home')]);

  const title = kind === 'tpl' ? '🖼 قالب‌های پروفایل' : kind === 'result' ? '🏆 عکس‌های نتیجهٔ نبرد' : '🎁 عکس محصولات و آیتم‌ها';
  return { text: `<b>${title}</b>\n✅ = عکس دارد  ⬜️ = ندارد\nیکی را انتخاب کنید:`, keyboard: Markup.inlineKeyboard(rows) };
}

async function levelsScreen() {
  const rows = await botImageModel.listByPrefix('level:');
  const configured = rows.map((r) => r.slot_key.slice('level:'.length));
  const levels = configured.filter((n) => n !== 'default').sort((a, b) => Number(a) - Number(b));

  const kb = [
    [Markup.button.callback(`${configured.includes('default') ? '✅' : '⬜️'} عکس پیش‌فرض (برای لول‌های بدون عکس)`, 'adm:slot:level:default')],
    [Markup.button.callback('➕ تنظیم عکس برای یک لول مشخص', 'adm:levelnew')],
  ];
  for (let i = 0; i < levels.length; i += 3) {
    kb.push(levels.slice(i, i + 3).map((n) => Markup.button.callback(`✅ لول ${n}`, `adm:slot:level:${n}`)));
  }
  kb.push([Markup.button.callback('🔙 منوی اصلی', 'adm:home')]);

  return {
    text:
      '🆙 <b>عکس ارتقای لول</b>\n\n' +
      'وقتی بازیکنی در تمرین به یک لول می‌رسد، عکس همان لول (اگر تنظیم شده) و در غیر این صورت عکس پیش‌فرض همراه پیام تبریک ارسال می‌شود.\n' +
      `لول‌های دارای عکس: ${levels.length ? levels.join('، ') : 'هیچ'}`,
    keyboard: Markup.inlineKeyboard(kb),
  };
}

async function slotScreen(slotKey) {
  const status = await describe(slotKey);
  const r = await imageService.resolve(slotKey);
  const rows = [[Markup.button.callback('📤 ارسال / تعویض عکس', `adm:send:${slotKey}`)]];
  if (r) rows.push([Markup.button.callback('👁 نمایش عکس فعلی', `adm:show:${slotKey}`)]);
  if (r && r.row && r.row.source === 'admin') rows.push([Markup.button.callback('🗑 حذف عکس ادمین', `adm:del:${slotKey}`)]);
  const parsed = slots.parseSlotKey(slotKey);
  const back = parsed.kind === 'level' ? 'adm:levels' : parsed.kind === 'shop' ? 'adm:home' : `adm:list:${parsed.kind}:0`;
  rows.push([Markup.button.callback('🔙 بازگشت', back)]);
  return {
    text: `<b>${slots.slotLabel(slotKey)}</b>\n<code>${slotKey}</code>\n\nوضعیت: ${status}`,
    keyboard: Markup.inlineKeyboard(rows),
  };
}

async function show(ctx, screen, edit) {
  const extra = { parse_mode: 'HTML', ...screen.keyboard };
  if (edit) return ctx.editMessageText(screen.text, extra).catch(() => ctx.reply(screen.text, extra));
  return ctx.reply(screen.text, extra);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function register(bot) {
  bot.command(['admin', 'images'], async (ctx) => {
    if (!isPrivate(ctx)) return;
    if (!isAdmin(ctx)) return ctx.reply('🚫 این پنل فقط برای ادمین مادر است.');
    pending.delete(ctx.from.id);
    await show(ctx, mainMenu(), false);
  });

  // Every adm: button is checked again — callback_data can be forwarded/replayed.
  bot.action(/^adm:(.+)$/, async (ctx, next) => {
    if (!isAdmin(ctx) || !isPrivate(ctx)) return ctx.answerCbQuery('🚫 فقط ادمین مادر.', { show_alert: true });
    const arg = ctx.match[1];

    if (arg === 'noop') return ctx.answerCbQuery();
    await ctx.answerCbQuery();

    if (arg === 'home') {
      pending.delete(ctx.from.id);
      return show(ctx, mainMenu(), true);
    }
    let m;
    if ((m = /^list:(tpl|item):(\d+)$/.exec(arg))) return show(ctx, await slotList(m[1], Number(m[2])), true);
    if (arg === 'levels') {
      pending.delete(ctx.from.id);
      return show(ctx, await levelsScreen(), true);
    }
    if (arg === 'levelnew') {
      setPending(ctx.from.id, { type: 'level_number' });
      return ctx.editMessageText('🆙 شمارهٔ لول را به‌صورت عدد بفرستید (مثلاً 5):', Markup.inlineKeyboard([[Markup.button.callback('🔙 انصراف', 'adm:levels')]])).catch(() => {});
    }
    if ((m = /^slot:(.+)$/.exec(arg))) {
      if (!slots.isValidSlotKey(m[1])) return ctx.reply('⚠️ بخش نامعتبر است.');
      return show(ctx, await slotScreen(m[1]), true);
    }
    if ((m = /^send:(.+)$/.exec(arg))) {
      if (!slots.isValidSlotKey(m[1])) return ctx.reply('⚠️ بخش نامعتبر است.');
      setPending(ctx.from.id, { type: 'photo', slotKey: m[1] });
      return ctx.editMessageText(
        `📤 حالا عکس برای «${slots.slotLabel(m[1])}» را بفرستید.\n\n` +
        '⚠️ حتماً به‌صورت <b>عکس</b> (Photo) بفرستید، نه فایل (File/Document).',
        { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 انصراف', `adm:slot:${m[1]}`)]]) }
      ).catch(() => {});
    }
    if ((m = /^show:(.+)$/.exec(arg))) {
      const photo = await imageService.photoFor(m[1]);
      if (!photo) return ctx.reply('عکسی تنظیم نشده.');
      const msg = await ctx.replyWithPhoto(photo.input, { caption: slots.slotLabel(m[1]) });
      await photo.remember(msg);
      return undefined;
    }
    if ((m = /^del:(.+)$/.exec(arg))) {
      await imageService.remove(m[1]);
      return show(ctx, await slotScreen(m[1]), true);
    }
    return next();
  });

  // Text answer for "which level?" — only while the admin is in that step.
  bot.on('text', async (ctx, next) => {
    if (!isPrivate(ctx) || !isAdmin(ctx)) return next();
    const p = getPending(ctx.from.id);
    if (!p || p.type !== 'level_number') return next();

    const n = Number(String(ctx.message.text).trim());
    const slotKey = slots.levelSlot(n);
    if (!Number.isInteger(n) || !slots.isValidSlotKey(slotKey)) {
      return ctx.reply('⚠️ یک عدد صحیح بین ۱ تا ۹۹۹ بفرستید.');
    }
    setPending(ctx.from.id, { type: 'photo', slotKey });
    return ctx.reply(`📤 حالا عکس «${slots.slotLabel(slotKey)}» را به‌صورت Photo بفرستید.`);
  });

  bot.on('photo', async (ctx, next) => {
    if (!isPrivate(ctx) || !isAdmin(ctx)) return next();
    const p = getPending(ctx.from.id);
    if (!p || p.type !== 'photo') {
      return ctx.reply('اول از /admin بخشی را انتخاب کنید، بعد عکس را بفرستید.');
    }
    const photo = imageService.largestPhoto(ctx.message);
    await imageService.setFromAdmin(p.slotKey, photo, ctx.from.id);
    pending.delete(ctx.from.id);

    await ctx.reply(`✅ عکس «${slots.slotLabel(p.slotKey)}» ذخیره شد.`, Markup.inlineKeyboard([
      [Markup.button.callback('📋 نمایش این بخش', `adm:slot:${p.slotKey}`)],
      [Markup.button.callback('🛠 منوی اصلی', 'adm:home')],
    ]));
    return undefined;
  });

  bot.on('document', async (ctx, next) => {
    if (!isPrivate(ctx) || !isAdmin(ctx) || !getPending(ctx.from.id)) return next();
    return ctx.reply('⚠️ عکس را به‌صورت فایل فرستادید. لطفاً دوباره و این بار به‌صورت <b>Photo</b> (فشرده) بفرستید.', { parse_mode: 'HTML' });
  });
}

module.exports = { register };
