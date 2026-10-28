'use strict';
const crypto = require('crypto');
const C = require('../config/constants');
const slots = require('../config/imageSlots');
const imageService = require('./imageService');
const profileCardService = require('./profileCardService');
const characterModel = require('../database/models/characterModel');
const P = require('../character/parts');
const renderer = require('../character/renderer');
const { drawCharacterCard } = require('../character/card');
const { loadCanvas } = require('../utils/canvasDraw');
const { scheduleDelete } = require('../utils/messageCleanup');

/**
 * Sends the 8:10 «شخصیت» card into a chat. Like the profile card it is rendered once per distinct
 * look (hash of everything drawn) and re-sent by Telegram file_id afterwards (kept in memory).
 */
const fileIdCache = new Map(); // hash -> file_id
const FILE_CACHE_MAX = 500;
const isBadFileId = (err) => /wrong file identifier|wrong remote file identifier|FILE_REFERENCE|file identifier/i.test(String((err && err.message) || err));

function isRenderingAvailable() {
  return !!loadCanvas();
}

async function buildCard(telegram, params) {
  const { telegramId, groupId } = params;
  const [prep, character] = await Promise.all([
    profileCardService.prepare(telegram, params),
    characterModel.getCharacter(telegramId, groupId),
  ]);
  const { vm } = prep;
  const gear = P.SLOTS.map((s) => character.outfit[s.id]).filter((id) => id && !P.GEAR[id].free).map((id) => P.GEAR[id].label);
  const view = {
    name: vm.name,
    username: vm.username,
    level: vm.level,
    xpPct: vm.xpPct,
    rank: vm.rank,
    templateKey: vm.templateKey,
    title: vm.title,
    stats: {
      maxHp: vm.stats.maxHp, attack: vm.stats.attack, defense: vm.stats.defense,
      speed: vm.stats.speed, crit: vm.stats.crit, winRate: vm.stats.winRate,
    },
    gear,
    appearance: character.appearance,
    outfit: character.outfit,
  };
  const tplSig = await imageService.getSignature(slots.templateSlot(vm.templateKey));
  const hash = crypto.createHash('sha1')
    .update(JSON.stringify({ v: C.CHARACTER_CARD_LAYOUT_VERSION, view, tplSig, art: renderer.artSignature(character.appearance, character.outfit) }))
    .digest('hex');
  return { view, hash };
}

async function backgroundFor(templateKey) {
  try {
    return (await imageService.getBuffer(slots.templateSlot(templateKey)))
      || (templateKey !== slots.DEFAULT_TEMPLATE_KEY ? await imageService.getBuffer(slots.templateSlot(slots.DEFAULT_TEMPLATE_KEY)) : null);
  } catch (err) {
    console.error('[character-card] background unavailable:', err.message);
    return null;
  }
}

/** params: { telegramId, groupId, displayName, username }; options: { extra, autoDelete } */
async function sendCharacterCard(telegram, chatId, params, { extra = {}, autoDelete = false } = {}) {
  const card = await buildCard(telegram, params);

  const send = async (input) => {
    const msg = await telegram.sendPhoto(chatId, input, extra);
    if (autoDelete) scheduleDelete(telegram, chatId, msg.message_id);
    return msg;
  };

  const cachedId = fileIdCache.get(card.hash);
  if (cachedId) {
    try {
      return await send(cachedId);
    } catch (err) {
      if (!isBadFileId(err)) throw err;
      fileIdCache.delete(card.hash);
    }
  }

  const lib = loadCanvas();
  if (!lib) throw new Error('CHARACTER_CARD_UNAVAILABLE');
  const canvas = await drawCharacterCard(lib, card.view, { background: await backgroundFor(card.view.templateKey) });
  const buffer = await canvas.encode('jpeg', C.PROFILE_CARD_JPEG_QUALITY);

  const msg = await send({ source: buffer, filename: 'character.jpg' });
  const photo = imageService.largestPhoto(msg);
  if (photo) {
    fileIdCache.set(card.hash, photo.file_id);
    if (fileIdCache.size > FILE_CACHE_MAX) fileIdCache.delete(fileIdCache.keys().next().value);
  }
  return msg;
}

module.exports = { sendCharacterCard, isRenderingAvailable };
