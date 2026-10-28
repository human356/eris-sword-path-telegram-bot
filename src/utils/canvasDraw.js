'use strict';
const fs = require('fs');
const path = require('path');
const slots = require('../config/imageSlots');

/**
 * Small canvas toolbox shared by the character card and the battle-result card
 * (same Vazirmatn fonts and text rules as the profile card).
 */
let lib = null;
let failed = false;
const FONT = { r: 'VazirR', m: 'VazirM', b: 'VazirB' };

function loadCanvas() {
  if (lib || failed) return lib;
  try {
    // eslint-disable-next-line global-require
    lib = require('@napi-rs/canvas');
    const dir = path.join(slots.ASSETS_DIR, 'fonts');
    const files = { r: 'Vazirmatn-Regular.ttf', m: 'Vazirmatn-Medium.ttf', b: 'Vazirmatn-Bold.ttf' };
    for (const [w, f] of Object.entries(files)) {
      const full = path.join(dir, f);
      if (fs.existsSync(full)) lib.GlobalFonts.registerFromPath(full, FONT[w]);
      else FONT[w] = 'sans-serif';
    }
  } catch (err) {
    failed = true;
    lib = null;
    console.error('[canvas] @napi-rs/canvas could not be loaded:', err.message);
  }
  return lib;
}

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

/** One line of text, shrunk / ellipsised to maxWidth. Persian is drawn RTL, Latin LTR. */
function drawText(ctx, text, x, y, o) {
  const { size, weight = 'r', color = '#fff', align = 'center', maxWidth, minSize = 12, shadow = 'rgba(0,0,0,0.6)' } = o;
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
    while (ctx.measureText(value).width > maxWidth && value.length > 1) value = `${value.slice(0, -2)}…`;
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

function safeLoad(lb, buf) {
  if (!buf) return Promise.resolve(null);
  return lb.loadImage(buf).catch(() => null);
}

module.exports = { loadCanvas, FONT, hasRtl, roundedRectPath, drawCover, drawText, safeLoad };
