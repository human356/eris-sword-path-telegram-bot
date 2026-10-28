'use strict';
const path = require('path');
const express = require('express');
const slots = require('../config/imageSlots');
const imageService = require('../services/imageService');
const userModel = require('../database/models/userModel');
const characterModel = require('../database/models/characterModel');
const P = require('../character/parts');
const renderer = require('../character/renderer');
const { requireTelegramUser } = require('./auth');
const { displayNameOf } = require('../utils/format');
const { loadCanvas, drawCover } = require('../utils/canvasDraw');

/**
 * Character Mini App (Telegram WebApp), served by the same Express server as the health check:
 *   GET  /app                  home page (EJS)
 *   GET  /app/character        customisation page (EJS)
 *   GET  /api/me               signed-in user + the groups where they own the doll
 *   GET  /api/character?g=     appearance / outfit / owned gear of one group
 *   POST /api/character?g=     save appearance / outfit (server re-validates everything)
 *   GET  /webapp-static/*      CSS / JS, the shared sprite engine, fonts, optional artist layers
 *   GET  /img/item/<KEY>.jpg   shop product picture (used as inline-result thumbnails)
 */
const PUBLIC_DIR = path.join(__dirname, 'public');
const CHAR_DIR = path.join(__dirname, '..', 'character');
const FONT_DIR = path.join(slots.ASSETS_DIR, 'fonts');

function sniffMime(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.slice(0, 4).toString() === 'RIFF') return 'image/webp';
  return 'application/octet-stream';
}

const thumbCache = new Map();
async function squareJpeg(buf, size) {
  const lib = loadCanvas();
  if (!lib) return null;
  try {
    const img = await lib.loadImage(buf);
    const cv = lib.createCanvas(size, size);
    drawCover(cv.getContext('2d'), img, 0, 0, size, size);
    return await cv.encode('jpeg', 80);
  } catch (err) {
    console.error('[webapp] thumbnail failed:', err.message);
    return null;
  }
}

function parseGroup(req) {
  const g = Number(req.query.g);
  return Number.isSafeInteger(g) && g !== 0 ? g : null;
}

// tiny per-user rate limit for the write endpoint
const lastSave = new Map();
function saveLimiter(req, res, next) {
  const now = Date.now();
  if (now - (lastSave.get(req.tgUser.id) || 0) < 800) return res.status(429).json({ ok: false, error: 'TOO_FAST' });
  lastSave.set(req.tgUser.id, now);
  if (lastSave.size > 5000) lastSave.delete(lastSave.keys().next().value);
  return next();
}

function createRouter() {
  const router = express.Router();

  // ---- pages ----
  router.get('/app', (req, res) => res.render('home', { title: 'اریس — شخصیت' }));
  router.get('/app/character', (req, res) => res.render('editor', { title: 'شخصی‌سازی شخصیت' }));

  // ---- static ----
  router.use('/webapp-static/fonts', express.static(FONT_DIR, { maxAge: '7d' }));
  router.use('/webapp-static/layers', express.static(renderer.DIR, { maxAge: '5m' }));
  router.get('/webapp-static/parts.js', (req, res) => res.sendFile(path.join(CHAR_DIR, 'parts.js')));
  router.get('/webapp-static/sprite.js', (req, res) => res.sendFile(path.join(CHAR_DIR, 'sprite.js')));
  router.use('/webapp-static', express.static(PUBLIC_DIR, { maxAge: '5m' }));

  // ---- shop product pictures (public, same pictures that are posted in the groups) ----
  router.get('/img/item/:file', async (req, res) => {
    try {
      const key = String(req.params.file).replace(/\.(jpg|jpeg|png|webp)$/i, '');
      if (!/^[A-Z0-9_]+$/.test(key)) return res.status(404).end();
      let buf = await imageService.getBuffer(slots.itemSlot(key));
      if (!buf) return res.status(404).end();
      // ?s=<px>: small square JPEG (inline-shop thumbnails must be tiny and fast, Telegram fetches ~50 at once)
      const size = Math.min(1024, Math.max(0, parseInt(req.query.s, 10) || 0));
      if (size) {
        const sig = await imageService.getSignature(slots.itemSlot(key)).catch(() => 'x');
        const cacheKey = `${key}:${sig}:${size}`;
        let small = thumbCache.get(cacheKey);
        if (!small) {
          small = await squareJpeg(buf, size);
          if (small) {
            thumbCache.set(cacheKey, small);
            if (thumbCache.size > 400) thumbCache.delete(thumbCache.keys().next().value);
          }
        }
        if (small) buf = small;
      }
      res.set('Content-Type', sniffMime(buf));
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    } catch (err) {
      console.error('[webapp] item image failed:', err.message);
      return res.status(404).end();
    }
  });

  // ---- API (Telegram-authenticated) ----
  const api = express.Router();
  api.use(express.json({ limit: '20kb' }));
  api.use(requireTelegramUser);

  api.get('/me', async (req, res) => {
    try {
      const u = req.tgUser;
      await userModel.upsertUser({ telegramId: u.id, username: u.username, displayName: displayNameOf(u) });
      const [all, unlocked] = await Promise.all([userModel.listGroupsOfPlayer(u.id), characterModel.listUnlockedGroups(u.id)]);
      const unlockedIds = new Set(unlocked.map((g) => Number(g.group_id)));
      const groups = all.map((g) => ({ id: Number(g.group_id), name: g.group_name || String(g.group_id), unlocked: unlockedIds.has(Number(g.group_id)) }));
      for (const g of unlocked) if (!groups.some((x) => x.id === Number(g.group_id))) groups.push({ id: Number(g.group_id), name: g.group_name || String(g.group_id), unlocked: true });
      res.json({ ok: true, user: { id: u.id, name: displayNameOf(u), username: u.username || null }, groups });
    } catch (err) {
      console.error('[webapp] /me failed:', err);
      res.status(500).json({ ok: false, error: 'SERVER' });
    }
  });

  api.get('/character', async (req, res) => {
    try {
      const groupId = parseGroup(req);
      if (!groupId) return res.status(400).json({ ok: false, error: 'BAD_GROUP' });
      if (!(await characterModel.hasCharacter(req.tgUser.id, groupId))) return res.status(403).json({ ok: false, error: 'NO_DOLL' });
      const [character, owned] = await Promise.all([characterModel.getCharacter(req.tgUser.id, groupId), characterModel.getOwnedGear(req.tgUser.id, groupId)]);
      res.json({ ok: true, appearance: character.appearance, outfit: character.outfit, ownedGear: Array.from(owned), layers: Object.keys(renderer.listLayers()) });
    } catch (err) {
      console.error('[webapp] GET /character failed:', err);
      res.status(500).json({ ok: false, error: 'SERVER' });
    }
  });

  api.post('/character', saveLimiter, async (req, res) => {
    try {
      const groupId = parseGroup(req);
      if (!groupId) return res.status(400).json({ ok: false, error: 'BAD_GROUP' });
      if (!(await characterModel.hasCharacter(req.tgUser.id, groupId))) return res.status(403).json({ ok: false, error: 'NO_DOLL' });
      const body = req.body || {};
      const saved = await characterModel.saveCharacter(req.tgUser.id, groupId, body.appearance, body.outfit);
      res.json({ ok: true, ...saved });
    } catch (err) {
      console.error('[webapp] POST /character failed:', err);
      res.status(500).json({ ok: false, error: 'SERVER' });
    }
  });

  router.use('/api', api);
  return router;
}

/** Mounts the Mini App on an Express app (sets up EJS). Safe to skip if `ejs` isn't installed. */
function mount(app) {
  // eslint-disable-next-line global-require
  require('ejs'); // fail early with a clear message when the dependency is missing
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(createRouter());
}

module.exports = { mount, createRouter, PARTS: P };
