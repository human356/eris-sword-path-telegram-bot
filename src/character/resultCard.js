'use strict';
const D = require('../utils/canvasDraw');
const renderer = require('./renderer');

/**
 * Battle-result card (1280x720): winner side on the left, loser side on the right, the Eris picture
 * (smiling when she wins / crying when she loses) at the top centre, and a status panel under each side.
 *
 * data = {
 *   title, subtitle,
 *   eris: 'win' | 'lose' | null           // which Eris picture to show in the centre (null = none)
 *   sides: [ { role: 'winner'|'loser'|'draw', members: [ {
 *       name, level?, hp?, hpMax?, kind: 'player'|'eris', appearance?, outfit?, lines: [text, ...] } ] } x2 ]
 * }
 * assets = { background?, erisWin?, erisLose? }  (image buffers)
 */
const W = 1280;
const H = 720;
const THEME = {
  panel: 'rgba(10,12,20,0.72)', stroke: 'rgba(255,255,255,0.28)', text: '#ffffff', muted: '#c4c9da',
  win: '#58d27a', lose: '#ef6a5b', draw: '#e0c25a', gold: '#f0c84a',
};
const ROLE_LABEL = { winner: 'برنده', loser: 'بازنده', draw: 'مساوی' };

function fitContain(ctx, img, x, y, w, h) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh), dw, dh); // bottom-aligned
}

async function drawSide(lib, ctx, side, box, imgs) {
  const color = THEME[side.role === 'winner' ? 'win' : side.role === 'loser' ? 'lose' : 'draw'];
  const members = side.members.slice(0, 4);
  const scale = members.length === 1 ? 7 : members.length === 2 ? 5 : 4;
  const groundY = box.y + box.h; // feet line
  const slotW = box.w / members.length;

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(box.x + box.w / 2, groundY + 2, Math.min(box.w / 2.2, 150 + members.length * 10), 18, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < members.length; i += 1) {
    const m = members[i];
    const cx = box.x + slotW * i + slotW / 2;
    ctx.save();
    if (side.role === 'loser') ctx.globalAlpha = 0.88;
    if (m.kind === 'eris') {
      const img = side.role === 'winner' ? imgs.erisWin : imgs.erisLose;
      if (img) fitContain(ctx, img, cx - slotW / 2 + 6, box.y, slotW - 12, box.h);
      else D.drawText(ctx, 'Eris', cx, groundY - 120, { size: 64, weight: 'b', color: THEME.text });
    } else {
      const size = 48 * scale;
      await renderer.drawCharacter(lib, ctx, m.appearance, m.outfit, { x: cx - (32 * scale) / 2, y: groundY - size, scale });
    }
    ctx.restore();
  }

  // ribbon
  const label = ROLE_LABEL[side.role] || '';
  ctx.font = `30px ${D.FONT.b}`;
  const rw = ctx.measureText(label).width + 56;
  D.roundedRectPath(ctx, box.x + box.w / 2 - rw / 2, box.y - 6, rw, 46, 23);
  ctx.fillStyle = color;
  ctx.fill();
  D.drawText(ctx, label, box.x + box.w / 2, box.y + 17, { size: 28, weight: 'b', color: '#10131c', shadow: null });
}

function drawPanel(ctx, side, box) {
  const color = THEME[side.role === 'winner' ? 'win' : side.role === 'loser' ? 'lose' : 'draw'];
  D.roundedRectPath(ctx, box.x, box.y, box.w, box.h, 26);
  ctx.fillStyle = THEME.panel;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  const members = side.members.slice(0, 4);
  const single = members.length === 1;
  const rowH = Math.min(single ? 200 : 86, (box.h - 20) / members.length);
  members.forEach((m, i) => {
    const y = box.y + 14 + i * rowH;
    const right = box.x + box.w - 24;
    const left = box.x + 24;
    const lvl = m.level ? `  ·  سطح ${m.level}` : '';
    D.drawText(ctx, `${m.name}${lvl}`, right, y + 22, { size: single ? 36 : members.length > 2 ? 24 : 30, weight: 'b', color: THEME.text, align: 'right', maxWidth: box.w - 240, minSize: 14 });

    if (m.hpMax) {
      const bw = single ? 190 : 170;
      const bh = single ? 22 : 16;
      const ratio = Math.max(0, Math.min(1, (m.hp || 0) / m.hpMax));
      D.roundedRectPath(ctx, left, y + 10, bw, bh, bh / 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      if (ratio > 0) {
        D.roundedRectPath(ctx, left, y + 10, Math.max(bh, bw * ratio), bh, bh / 2);
        ctx.fillStyle = ratio > 0.5 ? THEME.win : ratio > 0.25 ? THEME.draw : THEME.lose;
        ctx.fill();
      }
      D.drawText(ctx, `${m.hp || 0} / ${m.hpMax}`, left + bw / 2, y + 10 + bh + 16, { size: 16, color: THEME.muted, rtl: false, shadow: null });
    }
    const maxLines = single ? 5 : 3;
    const step = single ? 32 : 25;
    (m.lines || []).slice(0, maxLines).forEach((ln, j) => {
      D.drawText(ctx, ln, right, y + (single ? 66 : 46) + j * step - (!single && members.length > 2 ? 12 : 0), {
        size: single ? 24 : members.length > 2 ? 18 : 21, color: THEME.muted, align: 'right', maxWidth: box.w - 60, minSize: 12, shadow: null,
      });
    });
  });
}

async function drawBattleResult(lib, data, assets = {}) {
  const canvas = lib.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = await D.safeLoad(lib, assets.background);
  if (bg) {
    D.drawCover(ctx, bg, 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1b2038');
    g.addColorStop(1, '#3a1d2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(0,0,0,0.05)');
  veil.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  const imgs = { erisWin: await D.safeLoad(lib, assets.erisWin), erisLose: await D.safeLoad(lib, assets.erisLose) };
  const [left, right] = data.sides;

  // top centre: Eris picture (or just the big title when no picture applies)
  const centre = { x: 440, y: 30, w: 400, h: 360 };
  if (data.eris) {
    const img = data.eris === 'win' ? imgs.erisWin : imgs.erisLose;
    if (img) fitContain(ctx, img, centre.x, centre.y, centre.w, centre.h);
  }

  await drawSide(lib, ctx, left, { x: 30, y: 60, w: 390, h: 330 }, imgs);
  await drawSide(lib, ctx, right, { x: 860, y: 60, w: 390, h: 330 }, imgs);

  // title strip
  D.drawText(ctx, data.title, W / 2, data.eris ? 424 : 200, { size: data.eris ? 40 : 64, weight: 'b', color: THEME.gold, maxWidth: 520, minSize: 22 });
  if (data.subtitle) D.drawText(ctx, data.subtitle, W / 2, data.eris ? 458 : 262, { size: data.eris ? 22 : 28, color: THEME.muted, maxWidth: 520, minSize: 14 });

  drawPanel(ctx, left, { x: 30, y: 478, w: 590, h: 222 });
  drawPanel(ctx, right, { x: 660, y: 478, w: 590, h: 222 });
  return canvas;
}

module.exports = { drawBattleResult, W, H };
