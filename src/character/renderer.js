'use strict';
const fs = require('fs');
const path = require('path');
const slots = require('../config/imageSlots');
const sprite = require('./sprite');

/**
 * Server side of the character renderer: loads the optional artist-made PNG layers from
 * assets/character/<kind>/<id>.png (see docs/CHARACTER_IMAGE_PROMPTS.md) and draws the
 * character with sprite.js. Parts without a PNG are drawn procedurally.
 */
const DIR = path.join(slots.ASSETS_DIR, 'character');
const imageCache = new Map(); // file -> { mtimeMs, img }

/** Filesystem path of the layer for an override key ("hair_front/long"), or null. */
function layerFile(key) {
  const [kind, id] = key.split('/');
  if (!/^[a-z_]+$/.test(kind) || !/^[A-Za-z0-9_]+$/.test(id || '')) return null;
  for (const name of [id, id.toLowerCase()]) {
    const file = path.join(DIR, kind, `${name}.png`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/** Every layer file present — { key: file }. Used by the Mini App to know which parts have real art. */
function listLayers() {
  const out = {};
  let kinds = [];
  try { kinds = fs.readdirSync(DIR, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch { return out; }
  for (const d of kinds) {
    for (const f of fs.readdirSync(path.join(DIR, d.name))) {
      if (f.toLowerCase().endsWith('.png')) out[`${d.name}/${path.basename(f, '.png')}`] = path.join(DIR, d.name, f);
    }
  }
  return out;
}

async function loadOverrides(lib, appearance, outfit) {
  const overrides = {};
  for (const key of sprite.overrideKeys(appearance, outfit)) {
    const file = layerFile(key);
    if (!file) continue;
    try {
      const st = fs.statSync(file);
      const hit = imageCache.get(file);
      if (hit && hit.mtimeMs === st.mtimeMs) { overrides[key] = hit.img; continue; }
      const img = await lib.loadImage(await fs.promises.readFile(file));
      imageCache.set(file, { mtimeMs: st.mtimeMs, img });
      overrides[key] = img;
    } catch (err) {
      console.error('[character] bad layer image', file, err.message);
    }
  }
  return overrides;
}

/** Signature of the artwork used by a look (goes into card hashes so new art re-renders cards). */
function artSignature(appearance, outfit) {
  return sprite.overrideKeys(appearance, outfit).map((k) => {
    const f = layerFile(k);
    if (!f) return '-';
    try { return String(fs.statSync(f).mtimeMs | 0); } catch { return '-'; }
  }).join(',');
}

/** Draws the character at (x, y) with `scale`; `lib` = @napi-rs/canvas. Returns { width, height }. */
async function drawCharacter(lib, ctx, appearance, outfit, { x = 0, y = 0, scale = 8 } = {}) {
  const overrides = await loadOverrides(lib, appearance, outfit);
  return sprite.draw(ctx, appearance, outfit, { x, y, scale, overrides, makeCanvas: lib.createCanvas });
}

module.exports = { drawCharacter, listLayers, layerFile, artSignature, DIR };
