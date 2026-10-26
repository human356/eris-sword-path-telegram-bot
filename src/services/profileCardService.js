'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const C = require('../config/constants');
const itemsCatalog = require('../config/items.json');
const slots = require('../config/imageSlots');
const { LAYOUT, LABELS, STAT_ORDER, themeFor } = require('../config/profileLayout');
const imageService = require('./imageService');
const playerStatsModel = require('../database/models/playerStatsModel');
const showcaseModel = require('../database/models/showcaseModel');
const inventoryModel = require('../database/models/inventoryModel');
const profilePrefsModel = require('../database/models/profilePrefsModel');
const cardCacheModel = require('../database/models/profileCardCacheModel');
const { getRankByKey } = require('../utils/rankUtil');
const { xpRequiredForLevel, winRate } = require('../utils/formulas');
const { stripEmoji, shortLabel, isTitleKey } = require('../utils/itemText');
const { scheduleDelete } = require('../utils/messageCleanup');

/**
 * Image-card profile ("پروفایل عکسی").
 *
 * Cost model (spec: keep server load low):
 *   - the card is rendered ONCE and sent to Telegram; Telegram's file_id is stored
 *     in profile_card_cache together with a hash of everything drawn on the card;
 *   - every later /profile with an unchanged hash is just `sendPhoto(file_id)` —
 *     no rendering, no upload;
 *   - when anything on the card changes (name, @username, Telegram avatar, level,
 *     stats, showcase, title, template, the template/item pictures themselves)
 *     the hash changes, the card is re-rendered and the NEW file_id replaces the old one.
 *   HP / stamina / coins are deliberately NOT drawn (they change every few minutes);
 *   the card shows max HP / max stamina instead, which only change on level-up.
 */

// ---------------------------------------------------------------------------
// Canvas + fonts (optional dependency: if it can't load, callers fall back to text)
// ---------------------------------------------------------------------------

let canvasLib = null;
let canvasError = null;
const FONT = { r: 'VazirR', m: 'VazirM', b: 'VazirB' };

function loadCanvas() {
  if (canvasLib || canvasError) return canvasLib;
  try {
    // eslint-disable-next-line global-require
    canvasLib = require('@napi-rs/canvas');
    const fontDir = path.join(slots.ASSETS_DIR, 'fonts');
    const files = { r: 'Vazirmatn-Regular.ttf', m: 'Vazirmatn-Medium.ttf', b: 'Vazirmatn-Bold.ttf' };
    for (const [weight, file] of Object.entries(files)) {
      const full = path.join(fontDir, file);
      if (fs.existsSync(full)) {
        canvasLib.GlobalFonts.registerFromPath(full, FONT[weight]);
      } else {
        FONT[weight] = 'sans-serif';
        console.warn(`[profile-card] font missing: ${full} — Persian text may render badly.`);
      }
    }
  } catch (err) {
    canvasError = err;
    canvasLib = null;
    console.error('[profile-card] @napi-rs/canvas could not be loaded — profile will fall back to the text card:', err.message);
  }
  return canvasLib;
}

function isRenderingAvailable() {
  return !!loadCanvas();
}

// ---------------------------------------------------------------------------
// View-model (everything that is drawn) + cache hash
// ---------------------------------------------------------------------------

const avatarMetaCache = new Map(); // telegramId -> { at, value }
const AVATAR_META_TTL_MS = 60 * 1000;

/** Cheap API call (no image processing): the unique id tells us whether the Telegram avatar changed. */
async function getAvatarMeta(telegram, telegramId) {
  const hit = avatarMetaCache.get(telegramId);
  if (hit && Date.now() - hit.at < AVATAR_META_TTL_MS) return hit.value;

  let value;
  try {
    const res = await telegram.getUserProfilePhotos(telegramId, 0, 1);
    const sizes = res && res.total_count > 0 && res.photos && res.photos[0];
    if (sizes && sizes.length) {
      const pick = sizes.find((s) => s.width >= 320) || sizes[sizes.length - 1];
      value = { fileId: pick.file_id, uniqueId: pick.file_unique_id };
    } else {
      value = { none: true };
    }
  } catch {
    value = { error: true };
  }
  avatarMetaCache.set(telegramId, { at: Date.now(), value });
  return value;
}

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

async function prepare(telegram, { telegramId, groupId, displayName, username }) {
  const [stats, showcaseKeys, prefs, inventory, avatar] = await Promise.all([
    playerStatsModel.getPlayerStats(telegramId, groupId),
    showcaseModel.getShowcase(telegramId, groupId),
    profilePrefsModel.getPrefs(telegramId, groupId),
    inventoryModel.getInventory(telegramId, groupId),
    getAvatarMeta(telegram, telegramId),
  ]);
  if (!stats) throw new Error('profile card: player has no stats row');

  const owned = new Set(inventory.filter((r) => r.quantity > 0).map((r) => r.item_key));

  const templateKey =
    prefs.template_key && owned.has(prefs.template_key) &&
    itemsCatalog[prefs.template_key] && itemsCatalog[prefs.template_key].category === 'PROFILE_TEMPLATE'
      ? prefs.template_key
      : slots.DEFAULT_TEMPLATE_KEY;

  const titleKey = isTitleKey(prefs.title_key) && owned.has(prefs.title_key) ? prefs.title_key : null;
  const ownedTitleKeys = Array.from(owned).filter(isTitleKey).sort();
  const showcase = showcaseKeys.map((k) => (k && owned.has(k) && itemsCatalog[k] ? k : null));

  const rank = getRankByKey(stats.sword_rank);
  const required = xpRequiredForLevel(stats.level);

  const vm = {
    name: stripEmoji(displayName) || 'Player',
    username: username ? `@${username}` : '',
    level: stats.level,
    // Quantised so that tiny XP gains don't invalidate the cached card.
    xpPct: Math.min(100, Math.floor(((required > 0 ? stats.xp / required : 0) * 100) / C.PROFILE_CARD_XP_BAR_STEP_PERCENT) * C.PROFILE_CARD_XP_BAR_STEP_PERCENT),
    rank: stripEmoji(rank ? rank.label : stats.sword_rank),
    templateKey,
    title: titleKey ? shortLabel(titleKey) : '',
    ownedTitles: ownedTitleKeys.map((k) => shortLabel(k)),
    showcase: showcase.map((k) => (k ? { key: k, label: shortLabel(k) } : null)),
    stats: {
      attack: stats.attack,
      defense: stats.defense,
      speed: stats.speed,
      crit: `${Math.round(Number(stats.crit_chance) * 100)}%`,
      maxHp: stats.max_hp,
      maxStamina: stats.max_stamina,
      rating: fmt(stats.rating),
      winRate: `${Math.round(winRate(stats.wins, stats.losses) * 100)}%`,
      wins: fmt(stats.wins),
      losses: fmt(stats.losses),
      streak: stats.current_streak,
      respect: fmt(stats.eris_respect),
    },
  };

  const [tplSig, ...itemSigs] = await Promise.all([
    imageService.getSignature(slots.templateSlot(templateKey)),
    ...vm.showcase.map((s) => (s ? imageService.getSignature(slots.itemSlot(s.key)) : Promise.resolve('-'))),
  ]);

  const hashInput = {
    v: C.PROFILE_CARD_LAYOUT_VERSION,
    size: [LAYOUT.width, LAYOUT.height],
    vm,
    tplSig,
    itemSigs,
    avatar: avatar.uniqueId || (avatar.none ? 'none' : 'err'),
  };
  const hash = crypto.createHash('sha1').update(JSON.stringify(hashInput)).digest('hex');

  return { vm, hash, avatar, tplSig, volatile: !!avatar.error };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const hasRtl = (text) => /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(text);

function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * Draws one line of text. Shrinks the font until it fits `maxWidth`, then
 * ellipsises. Direction is picked from the text (Persian = RTL, Latin = LTR),
 * and alignment is always explicit (left/right/center), never "start/end".
 */
function drawText(ctx, text, x, y, o) {
  const { size, weight = 'r', color, align = 'center', maxWidth, minSize = 12, shadow = 'rgba(0,0,0,0.6)' } = o;
  let value = String(text);
  if (!value) return;

  ctx.direction = o.rtl === undefined ? (hasRtl(value) ? 'rtl' : 'ltr') : (o.rtl ? 'rtl' : 'ltr');
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';

  let fontSize = size;
  ctx.font = `${fontSize}px ${FONT[weight]}`;
  if (maxWidth) {
    while (ctx.measureText(value).width > maxWidth && fontSize > minSize) {
      fontSize -= 1;
      ctx.font = `${fontSize}px ${FONT[weight]}`;
    }
    while (ctx.measureText(value).width > maxWidth && value.length > 1) {
      value = `${value.slice(0, -2)}…`;
    }
  }

  ctx.save();
  if (shadow) {
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function drawPanel(ctx, rect, theme, radius = 22) {
  roundedRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.panelStroke;
  ctx.stroke();
}

function drawFallbackBackground(ctx, theme, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.bgFrom);
  g.addColorStop(1, theme.bgTo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.arc(W * 0.92, H * 0.1, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.05, H * 0.95, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawPanel(ctx, LAYOUT.header.panel, theme);
  drawPanel(ctx, LAYOUT.rankStrip.panel, theme);
  drawPanel(ctx, LAYOUT.stats.panel, theme);
  drawPanel(ctx, LAYOUT.showcase.panel, theme);
  drawPanel(ctx, LAYOUT.titles.panel, theme, 16);

  const lb = LAYOUT.levelBadge;
  ctx.beginPath();
  ctx.arc(lb.cx, lb.cy, lb.r, 0, Math.PI * 2);
  ctx.fillStyle = theme.panel;
  ctx.fill();
}

function drawAvatar(ctx, theme, vm, img) {
  const { cx, cy, r } = LAYOUT.avatar;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    g.addColorStop(0, theme.barFrom);
    g.addColorStop(1, theme.barTo);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();

  if (!img) {
    const initial = Array.from(vm.name)[0] || '?';
    drawText(ctx, initial.toUpperCase(), cx, cy + 4, { size: 96, weight: 'b', color: '#ffffff', shadow: 'rgba(0,0,0,0.35)' });
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = theme.accent;
  ctx.stroke();
}

function drawHeader(ctx, theme, vm) {
  const h = LAYOUT.header;
  drawText(ctx, vm.name, h.cx, h.name.y, { size: h.name.size, weight: 'b', color: theme.text, maxWidth: h.name.maxWidth, minSize: 24 });
  if (vm.username) {
    drawText(ctx, vm.username, h.cx, h.username.y, { size: h.username.size, color: theme.muted, maxWidth: h.username.maxWidth, rtl: false });
  }
  if (vm.title) {
    const p = h.titlePill;
    ctx.direction = 'rtl';
    ctx.font = `${p.size}px ${FONT.m}`;
    const textW = Math.min(p.maxWidth, ctx.measureText(vm.title).width);
    const w = textW + 56;
    roundedRectPath(ctx, h.cx - w / 2, p.y - p.h / 2, w, p.h, p.h / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.accent;
    ctx.stroke();
    drawText(ctx, vm.title, h.cx, p.y, { size: p.size, weight: 'm', color: theme.accent, maxWidth: p.maxWidth, shadow: null });
  }
}

function drawLevelBadge(ctx, theme, vm) {
  const lb = LAYOUT.levelBadge;
  ctx.beginPath();
  ctx.arc(lb.cx, lb.cy, lb.r, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = theme.accent;
  ctx.stroke();
  drawText(ctx, LABELS.level, lb.cx, lb.labelY, { size: lb.labelSize, weight: 'm', color: theme.muted });
  drawText(ctx, String(vm.level), lb.cx, lb.numberY, { size: lb.numberSize, weight: 'b', color: theme.text, maxWidth: lb.r * 1.5, rtl: false });
}

function drawRankStrip(ctx, theme, vm) {
  const r = LAYOUT.rankStrip;
  drawText(ctx, vm.rank, r.cx, r.rankY, { size: r.rankSize, weight: 'b', color: theme.accent, rtl: false, maxWidth: 900 });

  roundedRectPath(ctx, r.bar.x, r.bar.y, r.bar.w, r.bar.h, r.bar.h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();

  const ratio = Math.max(0, Math.min(1, vm.xpPct / 100));
  if (ratio > 0) {
    const w = Math.max(r.bar.h, r.bar.w * ratio);
    const g = ctx.createLinearGradient(r.bar.x, 0, r.bar.x + r.bar.w, 0);
    g.addColorStop(0, theme.barFrom);
    g.addColorStop(1, theme.barTo);
    roundedRectPath(ctx, r.bar.x, r.bar.y, w, r.bar.h, r.bar.h / 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
  drawText(ctx, `${vm.xpPct}% XP`, r.cx, r.xpTextY, {
    size: r.xpTextSize, color: theme.muted, rtl: false,
  });
}

function drawStats(ctx, theme, vm) {
  const s = LAYOUT.stats;
  STAT_ORDER.forEach((key, i) => {
    const col = i % s.cols;
    const row = Math.floor(i / s.cols);
    const x = s.startX + col * (s.cellW + s.gapX);
    const y = s.startY + row * (s.cellH + s.gapY);
    const midY = y + s.cellH / 2;

    drawText(ctx, LABELS.stats[key], x + s.cellW - 10, midY, {
      size: s.labelSize, color: theme.muted, align: 'right', rtl: true, maxWidth: s.cellW * 0.62,
    });
    drawText(ctx, String(vm.stats[key]), x + 10, midY, {
      size: s.valueSize, weight: 'b', color: theme.text, align: 'left', rtl: false, maxWidth: s.cellW * 0.34,
    });
  });
}

function drawShowcase(ctx, theme, vm, itemImages) {
  const sc = LAYOUT.showcase;
  drawText(ctx, LABELS.showcase, sc.panel.x + sc.panel.w / 2, sc.headingY, { size: sc.headingSize, weight: 'm', color: theme.muted });

  sc.slot.xs.forEach((x, i) => {
    const entry = vm.showcase[i];
    const size = sc.slot.size;
    const y = sc.slot.y;

    ctx.save();
    roundedRectPath(ctx, x, y, size, size, 16);
    ctx.clip();
    const img = entry ? itemImages[entry.key] : null;
    if (img) {
      drawCover(ctx, img, x, y, size, size);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();

    roundedRectPath(ctx, x, y, size, size, 16);
    ctx.lineWidth = 3;
    ctx.strokeStyle = entry ? theme.accent : theme.panelStroke;
    ctx.stroke();

    if (entry && !img) {
      drawText(ctx, entry.label, x + size / 2, y + size / 2, { size: 18, weight: 'm', color: theme.text, maxWidth: size - 14, minSize: 11 });
    }
    if (!entry) {
      drawText(ctx, LABELS.emptySlot, x + size / 2, y + size / 2, { size: 18, color: theme.muted, shadow: null });
    }
    if (entry) {
      drawText(ctx, entry.label, x + size / 2, sc.labelY, {
        size: sc.labelSize, color: theme.text, maxWidth: sc.labelMaxWidth, minSize: 11,
      });
    }
  });
}

function drawTitlesStrip(ctx, theme, vm) {
  const t = LAYOUT.titles;
  let line;
  if (vm.ownedTitles.length === 0) {
    line = LABELS.noTitles;
  } else {
    const shown = vm.ownedTitles.slice(0, 3).join(' • ');
    const more = vm.ownedTitles.length > 3 ? ` +${vm.ownedTitles.length - 3}` : '';
    line = `${LABELS.titles}: ${shown}${more}`;
  }
  drawText(ctx, line, t.cx, t.y, { size: t.size, color: theme.muted, maxWidth: t.maxWidth, minSize: 12 });
}

/**
 * Pure renderer: view-model + decoded pictures in, JPEG buffer out.
 * `assets` = { template?: Buffer, avatar?: Buffer, items?: { [itemKey]: Buffer } }
 */
async function renderCardBuffer(vm, assets = {}) {
  const lib = loadCanvas();
  if (!lib) throw new Error('PROFILE_CARD_UNAVAILABLE');

  const { createCanvas, loadImage } = lib;
  const W = LAYOUT.width;
  const H = LAYOUT.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.scale(W / LAYOUT.baseWidth, H / LAYOUT.baseHeight);

  const theme = themeFor(vm.templateKey);
  const safeLoad = async (buf) => {
    if (!buf) return null;
    try {
      return await loadImage(buf);
    } catch {
      return null;
    }
  };

  const templateImg = await safeLoad(assets.template);
  const avatarImg = await safeLoad(assets.avatar);
  const itemImages = {};
  for (const entry of vm.showcase) {
    if (entry && assets.items && assets.items[entry.key]) itemImages[entry.key] = await safeLoad(assets.items[entry.key]);
  }

  if (templateImg) {
    drawCover(ctx, templateImg, 0, 0, LAYOUT.baseWidth, LAYOUT.baseHeight);
    if (LAYOUT.drawPanelsOnTemplates) {
      drawPanel(ctx, LAYOUT.header.panel, theme);
      drawPanel(ctx, LAYOUT.rankStrip.panel, theme);
      drawPanel(ctx, LAYOUT.stats.panel, theme);
      drawPanel(ctx, LAYOUT.showcase.panel, theme);
      drawPanel(ctx, LAYOUT.titles.panel, theme, 16);
    }
  } else {
    drawFallbackBackground(ctx, theme, LAYOUT.baseWidth, LAYOUT.baseHeight);
  }

  drawAvatar(ctx, theme, vm, avatarImg);
  drawHeader(ctx, theme, vm);
  drawLevelBadge(ctx, theme, vm);
  drawRankStrip(ctx, theme, vm);
  drawStats(ctx, theme, vm);
  drawShowcase(ctx, theme, vm, itemImages);
  drawTitlesStrip(ctx, theme, vm);

  return canvas.encode('jpeg', C.PROFILE_CARD_JPEG_QUALITY);
}

// ---------------------------------------------------------------------------
// Fetching the pictures + sending with the file_id cache
// ---------------------------------------------------------------------------

const avatarBytes = new Map(); // uniqueId -> Buffer
const inflight = new Map(); // `${tid}:${gid}:${hash}` -> Promise<Buffer>

async function gatherAssets(telegram, card) {
  const assets = { items: {} };

  try {
    assets.template =
      (await imageService.getBuffer(slots.templateSlot(card.vm.templateKey))) ||
      (card.vm.templateKey !== slots.DEFAULT_TEMPLATE_KEY ? await imageService.getBuffer(slots.templateSlot(slots.DEFAULT_TEMPLATE_KEY)) : null);
  } catch (err) {
    console.error('[profile-card] template unavailable:', err.message);
  }

  if (card.avatar && card.avatar.fileId) {
    try {
      if (!avatarBytes.has(card.avatar.uniqueId)) {
        avatarBytes.set(card.avatar.uniqueId, await imageService.downloadTelegramFile(card.avatar.fileId));
        if (avatarBytes.size > 200) avatarBytes.delete(avatarBytes.keys().next().value);
      }
      assets.avatar = avatarBytes.get(card.avatar.uniqueId);
    } catch (err) {
      console.error('[profile-card] avatar download failed:', err.message);
      card.volatile = true; // don't cache a card that is missing its avatar by accident
    }
  }

  for (const entry of card.vm.showcase) {
    if (!entry) continue;
    try {
      assets.items[entry.key] = await imageService.getBuffer(slots.itemSlot(entry.key));
    } catch (err) {
      console.error('[profile-card] item picture unavailable:', entry.key, err.message);
    }
  }
  return assets;
}

const isBadFileId = (err) => /wrong file identifier|wrong remote file identifier|FILE_REFERENCE|file identifier/i.test(String((err && err.message) || err));

/**
 * Sends the player's profile card photo into `chatId`.
 *   params: { telegramId, groupId, displayName, username }
 *   options: { extra (sendPhoto options: caption, reply_markup, message_thread_id...), autoDelete }
 * Throws Error('PROFILE_CARD_UNAVAILABLE') when no canvas library is installed — the caller
 * should then send the old text profile.
 */
async function sendProfileCard(telegram, chatId, params, { extra = {}, autoDelete = false } = {}) {
  const card = await prepare(telegram, params);
  const cached = await cardCacheModel.getCard(params.telegramId, params.groupId);

  const send = async (photoInput) => {
    const msg = await telegram.sendPhoto(chatId, photoInput, extra);
    if (autoDelete) scheduleDelete(telegram, chatId, msg.message_id);
    return msg;
  };

  if (cached && cached.card_hash === card.hash) {
    try {
      return await send(cached.file_id);
    } catch (err) {
      if (!isBadFileId(err)) throw err;
      await cardCacheModel.deleteCard(params.telegramId, params.groupId);
    }
  }

  if (!isRenderingAvailable()) throw new Error('PROFILE_CARD_UNAVAILABLE');

  const key = `${params.telegramId}:${params.groupId}:${card.hash}`;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      gatherAssets(telegram, card)
        .then((assets) => renderCardBuffer(card.vm, assets))
        .finally(() => inflight.delete(key))
    );
  }
  const buffer = await inflight.get(key);

  const msg = await send({ source: buffer, filename: 'profile.jpg' });
  if (!card.volatile) {
    const photo = imageService.largestPhoto(msg);
    if (photo) await cardCacheModel.saveCard(params.telegramId, params.groupId, card.hash, photo.file_id);
  }
  return msg;
}

const userModel = require('../database/models/userModel');
const topicService = require('./topicService');

/**
 * Called after the player changed something about their profile inside the bot
 * (template, title, showcase): re-renders the card if needed and posts the NEW
 * picture into the group (auto-deleted like other group chatter).
 */
async function postUpdatedCard(telegram, { telegramId, groupId, caption }) {
  const user = await userModel.getUser(telegramId);
  if (!user) return null;
  const thread = await topicService.resolveAnnounceThread(groupId, 'PROFILE', 0).catch(() => 0);
  return sendProfileCard(
    telegram,
    groupId,
    { telegramId, groupId, displayName: user.display_name, username: user.username },
    { extra: { caption, parse_mode: 'HTML', ...(thread ? { message_thread_id: thread } : {}) }, autoDelete: true }
  );
}

module.exports = { postUpdatedCard, sendProfileCard, renderCardBuffer, prepare, isRenderingAvailable, loadCanvas };
