/* eslint-disable */
// Procedural semi-pixel character renderer (Node @napi-rs/canvas AND browser <canvas>).
// The character lives on a 32x48 "pixel" grid. Every part can optionally be replaced by an
// artist-made PNG layer (512x768 = grid x16) passed in `overrides` — see docs/CHARACTER_IMAGE_PROMPTS.md.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./parts'));
  else root.CharSprite = factory(root.CharParts);
})(typeof self !== 'undefined' ? self : this, function (P) {
  const GRID_W = 32;
  const GRID_H = 48;
  const PAD = 2; // outline room around the grid
  const OUTLINE = '#1e1a24';

  // ---- colour helpers -------------------------------------------------------
  function hexToRgb(hex) {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function shade(hex, f) { // f<0 darker, f>0 lighter
    const [r, g, b] = hexToRgb(hex);
    return f < 0 ? toHex(r * (1 + f), g * (1 + f), b * (1 + f)) : toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
  }

  // ---- procedural layers ----------------------------------------------------
  const HEAD = { x: 9, y: 5, w: 14, h: 14 };
  const INSETS = {
    round:  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    oval:   [2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3],
    square: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    heart:  [1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4],
  };

  function body(a) { // gender-dependent torso column
    return a.gender === 'female' ? { tx: 12, tw: 8 } : { tx: 11, tw: 10 };
  }

  const L = {};

  L.body = (c, a) => {
    const { tx, tw } = body(a);
    const skin = a.skin;
    const dark = shade(skin, -0.12);
    c.fill(14, 19, 4, 3, dark); // neck
    c.fill(tx, 21, tw, 12, skin); // torso (hidden by clothes)
    c.fill(tx - 2, 22, 2, 10, skin); // arms
    c.fill(tx + tw, 22, 2, 10, skin);
    c.fill(12, 33, 4, 10, skin); // legs
    c.fill(16, 33, 4, 10, dark);
  };

  L.bottom = (c, a, g) => {
    c.fill(12, 33, 4, 10, g.c1);
    c.fill(16, 33, 4, 10, g.c2);
    if (g.shape === 'greaves') {
      c.fill(12, 37, 4, 6, g.c1); c.fill(16, 37, 4, 6, shade(g.c1, -0.15));
      c.fill(12, 36, 4, 1, shade(g.c1, 0.25)); c.fill(16, 36, 4, 1, shade(g.c1, 0.1));
      c.fill(12, 33, 4, 3, '#3b3f58'); c.fill(16, 33, 4, 3, '#2a2d40');
    } else {
      c.fill(12, 33, 1, 10, shade(g.c1, 0.12));
    }
  };

  L.shoes = (c, a, g) => {
    c.fill(11, 43, 5, 3, g.c1); c.fill(16, 43, 5, 3, shade(g.c1, -0.1));
    c.fill(11, 45, 5, 1, g.c2); c.fill(16, 45, 5, 1, g.c2);
    c.fill(11, 43, 5, 1, g.c2); c.fill(16, 43, 5, 1, g.c2);
  };

  L.top = (c, a, g) => {
    const { tx, tw } = body(a);
    const { c1, c2, shape } = g;
    if (shape === 'robe') {
      c.fill(tx - 1, 21, tw + 2, 18, c1);
      c.fill(tx - 3, 22, 3, 9, c1); c.fill(tx + tw + 0, 22, 3, 9, c1);
      c.fill(15, 21, 2, 18, c2);
      c.fill(tx - 1, 38, tw + 2, 1, c2);
      c.fill(tx - 3, 30, 3, 1, c2); c.fill(tx + tw, 30, 3, 1, c2);
      c.fill(tx, 29, tw, 1, shade(c1, -0.25));
      return;
    }
    if (shape === 'armor') {
      c.fill(tx, 21, tw, 11, c1);
      c.fill(tx - 3, 21, 3, 4, c2); c.fill(tx + tw, 21, 3, 4, c2);
      c.fill(tx - 3, 21, 3, 1, shade(c1, 0.3)); c.fill(tx + tw, 21, 3, 1, shade(c1, 0.3));
      c.fill(tx + 1, 23, tw - 2, 1, shade(c1, 0.25));
      c.fill(15, 22, 2, 9, c2);
      c.fill(tx, 31, tw, 1, c2);
      c.fill(15, 31, 2, 1, '#f0c84a');
      return;
    }
    if (shape === 'noble') {
      c.fill(tx, 21, tw, 12, c1);
      c.fill(tx - 2, 22, 2, 8, c1); c.fill(tx + tw, 22, 2, 8, c1);
      c.fill(tx - 2, 29, 2, 1, c2); c.fill(tx + tw, 29, 2, 1, c2);
      c.fill(tx + 1, 21, tw - 2, 1, c2); c.fill(tx, 32, tw, 1, c2);
      for (const y of [23, 26, 29]) c.fill(15, y, 2, 1, c2);
      c.fill(15, 22, 2, 11, shade(c1, -0.18));
      for (const y of [23, 26, 29]) c.fill(15, y, 2, 1, c2);
      return;
    }
    // tunic (default)
    c.fill(tx, 21, tw, 11, c1);
    c.fill(tx - 2, 22, 2, 4, c1); c.fill(tx + tw, 22, 2, 4, c1);
    c.fill(tx - 2, 25, 2, 1, c2); c.fill(tx + tw, 25, 2, 1, c2);
    c.fill(tx + 2, 21, tw - 4, 1, c2);
    c.fill(tx, 29, tw, 1, c2);
    c.fill(15, 29, 2, 1, '#f0c84a');
    c.fill(tx, 31, tw, 1, shade(c1, -0.15));
    c.fill(tx, 22, 1, 7, shade(c1, 0.12));
  };

  L.gloves = (c, a, g) => {
    const { tx, tw } = body(a);
    c.fill(tx - 2, 29, 2, 4, g.c1); c.fill(tx + tw, 29, 2, 4, g.c1);
    c.fill(tx - 2, 29, 2, 1, g.c2); c.fill(tx + tw, 29, 2, 1, g.c2);
  };

  L.cape = (c, a, g) => {
    const { tx, tw } = body(a);
    c.fill(tx - 3, 21, tw + 6, 23, g.c1);
    c.fill(tx - 3, 43, tw + 6, 1, g.c2);
    c.fill(tx - 1, 24, 1, 19, shade(g.c1, -0.18)); c.fill(tx + tw, 24, 1, 19, shade(g.c1, -0.18));
  };
  L.capeClasp = (c, a, g) => { c.fill(14, 21, 4, 1, g.c2); c.fill(15, 22, 2, 1, g.c2); };

  L.head = (c, a) => {
    const ins = INSETS[a.face] || INSETS.round;
    for (let r = 0; r < HEAD.h; r++) c.fill(HEAD.x + ins[r], HEAD.y + r, HEAD.w - ins[r] * 2, 1, a.skin);
    c.fill(HEAD.x + 2, HEAD.y + 12, 1, 1, shade(a.skin, -0.06));
  };

  L.ears = (c, a) => {
    const s = a.skin;
    const mirror = (x, y, w, h) => { c.fill(x, y, w, h, s); c.fill(GRID_W - x - w, y, w, h, s); };
    if (a.ears === 'small') mirror(8, 11, 1, 2);
    else if (a.ears === 'large') { mirror(7, 9, 2, 4); }
    else if (a.ears === 'pointed') { mirror(8, 10, 1, 3); mirror(7, 9, 1, 2); mirror(6, 8, 1, 2); }
    else mirror(8, 10, 1, 3);
  };

  L.eyes = (c, a) => {
    const col = a.eyeColor;
    for (const ex of [11, 18]) {
      const mirrored = ex === 18;
      if (a.eyes === 'round') {
        c.fill(ex, 11, 3, 3, col); c.fill(ex, 11, 1, 1, '#ffffff'); c.fill(mirrored ? ex + 2 : ex, 13, 1, 1, shade(col, 0.35));
      } else if (a.eyes === 'sharp') {
        c.fill(ex, 12, 3, 2, col); c.fill(mirrored ? ex + 3 : ex - 1, 11, 1, 1, '#1e1a24'); c.fill(ex + 1, 12, 1, 1, '#ffffff');
        c.fill(ex, 11, 3, 1, '#1e1a24');
      } else if (a.eyes === 'sleepy') {
        c.fill(ex, 12, 3, 1, col); c.fill(ex, 11, 3, 1, shade(a.skin, -0.25));
      } else if (a.eyes === 'happy') {
        c.fill(ex, 13, 1, 1, '#1e1a24'); c.fill(ex + 1, 12, 1, 1, '#1e1a24'); c.fill(ex + 2, 13, 1, 1, '#1e1a24');
      } else {
        c.fill(ex, 11, 2, 3, col); c.fill(mirrored ? ex + 1 : ex, 11, 1, 1, '#ffffff');
        c.fill(mirrored ? ex : ex + 1, 11, 1, 3, shade(col, -0.2));
      }
      if (a.gender === 'female' && a.eyes !== 'happy') c.fill(mirrored ? ex + 3 : ex - 1, 11, 1, 1, '#1e1a24'); // lash
    }
  };

  L.eyebrow = (c, a) => {
    const col = a.eyebrowColor;
    if (a.eyebrow === 'thick') { c.fill(11, 8, 3, 2, col); c.fill(18, 8, 3, 2, col); }
    else if (a.eyebrow === 'angled') {
      c.fill(11, 8, 2, 1, col); c.fill(13, 9, 1, 1, col);
      c.fill(19, 8, 2, 1, col); c.fill(18, 9, 1, 1, col);
    } else if (a.eyebrow === 'straight') { c.fill(11, 9, 3, 1, col); c.fill(18, 9, 3, 1, col); }
    else { c.fill(12, 9, 2, 1, col); c.fill(18, 9, 2, 1, col); }
  };

  L.nose = (c, a) => {
    const s = shade(a.skin, -0.25);
    if (a.nose === 'normal') c.fill(15, 14, 2, 2, s);
    else if (a.nose === 'big') c.fill(14, 14, 4, 2, s);
    else if (a.nose === 'pointed') { c.fill(16, 12, 1, 3, shade(a.skin, -0.12)); c.fill(15, 15, 2, 1, s); }
    else c.fill(15, 14, 2, 1, s);
  };

  L.mustache = (c, a) => {
    const col = a.mustacheColor;
    if (a.mustache === 'classic') c.fill(12, 15, 8, 1, col);
    else if (a.mustache === 'handlebar') { c.fill(12, 15, 8, 1, col); c.fill(11, 14, 1, 1, col); c.fill(20, 14, 1, 1, col); c.fill(11, 16, 1, 1, col); c.fill(20, 16, 1, 1, col); }
    else if (a.mustache === 'goatee') { c.fill(13, 15, 6, 1, col); c.fill(14, 18, 4, 2, col); }
    else if (a.mustache === 'beard') {
      c.fill(9, 13, 2, 5, col); c.fill(21, 13, 2, 5, col); c.fill(11, 17, 10, 2, col); c.fill(11, 18, 10, 2, col);
      c.fill(12, 15, 8, 1, col);
    }
  };

  L.mouth = (c, a) => {
    const m = '#9a3d45';
    const y = a.mustache === 'beard' ? 16 : 16;
    if (a.mouth === 'neutral') c.fill(14, y + 1, 4, 1, m);
    else if (a.mouth === 'open') { c.fill(14, y, 4, 2, '#5a1e28'); c.fill(15, y + 1, 2, 1, '#e0707a'); }
    else if (a.mouth === 'smirk') { c.fill(14, y + 1, 3, 1, m); c.fill(17, y, 1, 1, m); }
    else if (a.mouth === 'sad') { c.fill(14, y + 1, 1, 1, m); c.fill(15, y, 2, 1, m); c.fill(17, y + 1, 1, 1, m); }
    else { c.fill(14, y, 1, 1, m); c.fill(15, y + 1, 2, 1, m); c.fill(17, y, 1, 1, m); }
  };

  function cap(c, col) {
    c.fill(10, 3, 12, 1, col);
    c.fill(9, 4, 14, 4, col);
    c.fill(9, 8, 2, 3, col); c.fill(21, 8, 2, 3, col);
    c.fill(11, 4, 4, 1, shade(col, 0.28));
  }
  L.hairBack = (c, a) => {
    const col = shade(a.hairColor, -0.1);
    if (a.hair === 'long') c.fill(8, 4, 16, 20, col);
    else if (a.hair === 'ponytail') { c.fill(23, 4, 3, 15, col); c.fill(22, 4, 2, 2, '#e04a4a'); }
    else if (a.hair === 'twintail') { c.fill(6, 6, 3, 17, col); c.fill(23, 6, 3, 17, col); c.fill(6, 6, 3, 1, '#e04a4a'); c.fill(23, 6, 3, 1, '#e04a4a'); }
  };
  L.hairFront = (c, a) => {
    const col = a.hairColor;
    switch (a.hair) {
      case 'bald': return;
      case 'spiky':
        cap(c, col);
        c.fill(10, 1, 2, 3, col); c.fill(13, 0, 2, 4, col); c.fill(16, 1, 2, 3, col); c.fill(19, 1, 2, 3, col);
        c.fill(22, 3, 1, 2, col);
        return;
      case 'bun':
        cap(c, col); c.fill(13, 0, 6, 3, col); c.fill(14, 0, 2, 1, shade(col, 0.3));
        return;
      default:
        cap(c, col);
    }
  };

  const WEAPON_X = (a) => body(a).tx + body(a).tw + 2;
  L.weapon = (c, a, g) => {
    const wx = WEAPON_X(a);
    if (g.shape === 'staff') {
      c.fill(wx, 9, 2, 25, g.c1); c.fill(wx - 1, 5, 4, 4, g.c2); c.fill(wx, 6, 2, 2, '#ffffff');
    } else {
      c.fill(wx, 13, 2, 17, g.c1); c.fill(wx, 12, 2, 1, shade(g.c1, 0.3)); c.fill(wx, 13, 1, 17, shade(g.c1, 0.3));
      c.fill(wx - 2, 30, 6, 1, g.c2); c.fill(wx, 31, 2, 3, g.c2);
      if (g.shape === 'flamesword') {
        c.fill(wx, 14, 1, 14, g.c2);
        c.fill(wx - 1, 10, 1, 2, g.c1); c.fill(wx + 2, 9, 1, 2, g.c2); c.fill(wx, 8, 1, 3, g.c1); c.fill(wx + 1, 11, 1, 1, g.c2);
      }
    }
  };

  L.hat = (c, a, g) => {
    const { shape, c1, c2 } = g;
    if (shape === 'helm') {
      c.fill(9, 2, 14, 6, c1); c.fill(8, 5, 2, 6, c2); c.fill(22, 5, 2, 6, c2); c.fill(15, 8, 2, 3, c2);
      c.fill(10, 2, 3, 1, shade(c1, 0.35)); c.fill(15, 0, 2, 2, '#c0392b');
    } else if (shape === 'wizard') {
      c.fill(12, 0, 8, 2, c1); c.fill(10, 2, 12, 3, c1); c.fill(6, 5, 20, 2, c1); c.fill(10, 4, 12, 1, c2); c.fill(13, 0, 2, 1, shade(c1, 0.3));
    } else if (shape === 'band') {
      c.fill(9, 6, 14, 2, c1); c.fill(22, 7, 3, 2, c2); c.fill(24, 9, 1, 2, c2);
    } else if (shape === 'crown') {
      c.fill(10, 4, 12, 2, c1); c.fill(10, 2, 2, 2, c1); c.fill(15, 1, 2, 3, c1); c.fill(20, 2, 2, 2, c1);
      c.fill(15, 4, 2, 1, '#d94a6a'); c.fill(11, 5, 10, 1, c2);
    }
  };

  L.accessory = (c, a, g) => {
    const { shape, c1, c2 } = g;
    if (shape === 'glasses') {
      for (const x of [10, 17]) {
        c.fill(x, 10, 5, 1, c1); c.fill(x, 14, 5, 1, c1); c.fill(x, 10, 1, 5, c1); c.fill(x + 4, 10, 1, 5, c1);
        c.fill(x + 1, 11, 3, 3, c2, 0.35);
      }
      c.fill(15, 11, 2, 1, c1);
    } else if (shape === 'mask') {
      c.fill(9, 9, 14, 5, c1); c.fill(11, 10, 3, 3, c2); c.fill(18, 10, 3, 3, c2);
      c.fill(12, 11, 1, 2, a.eyeColor); c.fill(19, 11, 1, 2, a.eyeColor); c.fill(22, 10, 2, 1, c1);
    } else if (shape === 'amulet') {
      const { tx } = body(a);
      c.fill(tx + 2, 21, 1, 1, c1); c.fill(tx + 3, 22, 1, 1, c1); c.fill(15, 23, 2, 1, c1);
      c.fill(tx + 4 + 1 + (a.gender === 'female' ? 0 : 1), 22, 1, 1, c1);
      c.fill(15, 24, 2, 2, c2); c.fill(15, 24, 1, 1, shade(c2, 0.5));
    }
  };

  // ---- drawing engine ---------------------------------------------------------
  function defaultMakeCanvas(w, h) {
    if (typeof document !== 'undefined') { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
    throw new Error('makeCanvas is required outside the browser');
  }

  function pixelPainter(ctx) {
    return {
      fill(x, y, w, h, color, alpha) {
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = color;
        ctx.fillRect(x + PAD, y + PAD, w, h);
        ctx.globalAlpha = 1;
      },
    };
  }

  function outlineCanvas(small, makeCanvas) {
    const w = small.width; const h = small.height;
    const sctx = small.getContext('2d');
    const src = sctx.getImageData(0, 0, w, h);
    const out = makeCanvas(w, h);
    const octx = out.getContext('2d');
    const dst = octx.createImageData(w, h);
    const [or, og, ob] = hexToRgb(OUTLINE);
    const alphaAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src.data[i + 3] > 40) {
          dst.data[i] = src.data[i]; dst.data[i + 1] = src.data[i + 1]; dst.data[i + 2] = src.data[i + 2]; dst.data[i + 3] = 255;
        } else if (alphaAt(x - 1, y) > 40 || alphaAt(x + 1, y) > 40 || alphaAt(x, y - 1) > 40 || alphaAt(x, y + 1) > 40) {
          dst.data[i] = or; dst.data[i + 1] = og; dst.data[i + 2] = ob; dst.data[i + 3] = 255;
        }
      }
    }
    octx.putImageData(dst, 0, 0);
    return out;
  }

  function tint(img, color, makeCanvas) {
    const cv = makeCanvas(img.width, img.height);
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = color;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(img, 0, 0);
    return cv;
  }

  /** Which override image keys a given look would use (so the caller can preload them). */
  function overrideKeys(appearance, outfit) {
    const a = P.sanitizeAppearance(appearance);
    const o = P.sanitizeOutfit(outfit);
    const keys = [`body/${a.gender}`, `face/${a.face}`, `ears/${a.ears}`, `eyes/${a.eyes}`, `nose/${a.nose}`, `mouth/${a.mouth}`,
      `eyebrow/${a.eyebrow}`, `hair_back/${a.hair}`, `hair_front/${a.hair}`];
    if (a.mustache !== 'none') keys.push(`mustache/${a.mustache}`);
    for (const slot of P.SLOTS) if (o[slot.id]) keys.push(`gear/${o[slot.id]}`);
    return keys;
  }

  /**
   * Draws the character with its top-left grid corner at (x, y), `scale` canvas px per pixel.
   * opts: { scale = 8, x = 0, y = 0, overrides = {key: Image}, makeCanvas }
   */
  function draw(ctx, appearanceIn, outfitIn, opts = {}) {
    const scale = opts.scale || 8;
    const x0 = opts.x || 0;
    const y0 = opts.y || 0;
    const overrides = opts.overrides || {};
    const makeCanvas = opts.makeCanvas || defaultMakeCanvas;
    const a = P.sanitizeAppearance(appearanceIn);
    const o = P.sanitizeOutfit(outfitIn);
    const gear = (slot) => (o[slot] ? P.GEAR[o[slot]] : null);
    const ov = (key) => overrides[key] || null;

    // Segments: { key?, proc(c), tintColor? }  — procedural unless an override exists for `key`.
    const layers = [];
    const add = (key, proc, tintColor) => layers.push({ key, proc, tintColor });
    const cape = gear('cape');
    if (cape) add(`gear/${o.cape}`, (c) => L.cape(c, a, cape));
    add(`hair_back/${a.hair}`, (c) => L.hairBack(c, a), a.hairColor);
    add(`body/${a.gender}`, (c) => L.body(c, a), a.skin);
    const bottom = gear('bottom'); const shoes = gear('shoes'); const top = gear('top'); const gloves = gear('gloves');
    if (bottom) add(`gear/${o.bottom}`, (c) => L.bottom(c, a, bottom));
    if (shoes) add(`gear/${o.shoes}`, (c) => L.shoes(c, a, shoes));
    if (top) add(`gear/${o.top}`, (c) => L.top(c, a, top));
    if (gloves) add(`gear/${o.gloves}`, (c) => L.gloves(c, a, gloves));
    if (cape) add(null, (c) => L.capeClasp(c, a, cape));
    add(`face/${a.face}`, (c) => L.head(c, a), a.skin);
    add(`ears/${a.ears}`, (c) => L.ears(c, a), a.skin);
    add(`eyes/${a.eyes}`, (c) => L.eyes(c, a));
    add(`nose/${a.nose}`, (c) => L.nose(c, a));
    if (a.mustache !== 'none') add(`mustache/${a.mustache}`, (c) => L.mustache(c, a), a.mustacheColor);
    add(`mouth/${a.mouth}`, (c) => L.mouth(c, a));
    add(`eyebrow/${a.eyebrow}`, (c) => L.eyebrow(c, a), a.eyebrowColor);
    add(`hair_front/${a.hair}`, (c) => L.hairFront(c, a), a.hairColor);
    const hat = gear('hat'); const acc = gear('accessory'); const weapon = gear('weapon');
    if (hat) add(`gear/${o.hat}`, (c) => L.hat(c, a, hat));
    if (acc) add(`gear/${o.accessory}`, (c) => L.accessory(c, a, acc));
    if (weapon) add(`gear/${o.weapon}`, (c) => L.weapon(c, a, weapon));

    const smallW = GRID_W + PAD * 2;
    const smallH = GRID_H + PAD * 2;
    ctx.imageSmoothingEnabled = false;

    let pending = null;
    const flush = () => {
      if (!pending) return;
      const outlined = outlineCanvas(pending.cv, makeCanvas);
      ctx.drawImage(outlined, 0, 0, smallW, smallH, x0 - PAD * scale, y0 - PAD * scale, smallW * scale, smallH * scale);
      pending = null;
    };
    for (const layer of layers) {
      const img = layer.key ? ov(layer.key) : null;
      if (img) {
        flush();
        const src = layer.tintColor ? tint(img, layer.tintColor, makeCanvas) : img;
        ctx.drawImage(src, 0, 0, src.width, src.height, x0, y0, GRID_W * scale, GRID_H * scale);
      } else {
        if (!pending) {
          const cv = makeCanvas(smallW, smallH);
          pending = { cv, painter: pixelPainter(cv.getContext('2d')) };
        }
        layer.proc(pending.painter);
      }
    }
    flush();
    return { width: GRID_W * scale, height: GRID_H * scale };
  }

  return { GRID_W, GRID_H, PAD, draw, overrideKeys, shade };
});
