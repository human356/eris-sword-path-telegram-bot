'use strict';
const D = require('../utils/canvasDraw');
const { LABELS, themeFor } = require('../config/profileLayout');
const renderer = require('./renderer');

/**
 * The «شخصیت» card: 8:10 (1080x1350) picture. The player's current profile-card background fills
 * the whole picture; the full-body character stands in the middle of the upper part and the
 * name / @username / level / rank / stats / worn gear are below.
 */
const W = 1080;
const H = 1350;

const STAT_KEYS = ['maxHp', 'attack', 'defense', 'speed', 'crit', 'winRate'];

async function drawCharacterCard(lib, vm, assets = {}) {
  const canvas = lib.createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const theme = themeFor(vm.templateKey);

  // ---- background: the profile template, cover-fitted, or the theme gradient ----
  const bg = await D.safeLoad(lib, assets.background);
  if (bg) {
    D.drawCover(ctx, bg, 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, theme.bgFrom);
    g.addColorStop(1, theme.bgTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  // readability veil (darker at the bottom where the text lives)
  const veil = ctx.createLinearGradient(0, 0, 0, H);
  veil.addColorStop(0, 'rgba(0,0,0,0.10)');
  veil.addColorStop(0.55, 'rgba(0,0,0,0.25)');
  veil.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // ---- stage: glow + ground shadow ----
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 420);
  glow.addColorStop(0, 'rgba(255,255,255,0.28)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 100, W, 800);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(W / 2, 806, 210, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // ---- character (32x48 grid, 14 px per pixel -> 448x672) ----
  const scale = 14;
  await renderer.drawCharacter(lib, ctx, vm.appearance, vm.outfit, { x: (W - 32 * scale) / 2, y: 130, scale });

  // ---- level badge + rank pill (top corners) ----
  ctx.beginPath();
  ctx.arc(110, 110, 70, 0, Math.PI * 2);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = theme.accent;
  ctx.stroke();
  D.drawText(ctx, LABELS.level, 110, 82, { size: 22, weight: 'm', color: theme.muted });
  D.drawText(ctx, String(vm.level), 110, 124, { size: 54, weight: 'b', color: theme.text, maxWidth: 100, rtl: false });

  if (vm.rank) {
    ctx.font = `28px ${D.FONT.b}`;
    const rw = Math.min(380, ctx.measureText(vm.rank).width + 60);
    D.roundedRectPath(ctx, W - 50 - rw, 70, rw, 56, 28);
    ctx.fillStyle = theme.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.accent;
    ctx.stroke();
    D.drawText(ctx, vm.rank, W - 50 - rw / 2, 99, { size: 28, weight: 'b', color: theme.accent, maxWidth: rw - 30, rtl: false, shadow: null });
  }

  // ---- info panel ----
  const panel = { x: 50, y: 850, w: W - 100, h: 450 };
  D.roundedRectPath(ctx, panel.x, panel.y, panel.w, panel.h, 36);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.panelStroke;
  ctx.stroke();

  D.drawText(ctx, vm.name, W / 2, 905, { size: 58, weight: 'b', color: theme.text, maxWidth: 900, minSize: 28 });
  if (vm.username) D.drawText(ctx, vm.username, W / 2, 962, { size: 32, color: theme.muted, maxWidth: 900, rtl: false });

  // xp bar
  const bar = { x: 190, y: 1000, w: 700, h: 20 };
  D.roundedRectPath(ctx, bar.x, bar.y, bar.w, bar.h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  const ratio = Math.max(0, Math.min(1, (vm.xpPct || 0) / 100));
  if (ratio > 0) {
    const g = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
    g.addColorStop(0, theme.barFrom);
    g.addColorStop(1, theme.barTo);
    D.roundedRectPath(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * ratio), bar.h, 10);
    ctx.fillStyle = g;
    ctx.fill();
  }
  D.drawText(ctx, `${vm.xpPct || 0}% XP`, W / 2, 1042, { size: 22, color: theme.muted, rtl: false, shadow: null });

  // stats 3 x 2
  const cellW = 300;
  const gap = 20;
  const startX = (W - (cellW * 3 + gap * 2)) / 2;
  STAT_KEYS.forEach((key, i) => {
    const x = startX + (i % 3) * (cellW + gap);
    const y = 1075 + Math.floor(i / 3) * 78;
    D.roundedRectPath(ctx, x, y, cellW, 64, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fill();
    D.drawText(ctx, LABELS.stats[key], x + cellW - 16, y + 32, { size: 24, color: theme.muted, align: 'right', rtl: true, maxWidth: 160, shadow: null });
    D.drawText(ctx, String(vm.stats[key]), x + 16, y + 32, { size: 30, weight: 'b', color: theme.text, align: 'left', rtl: false, maxWidth: 110, shadow: null });
  });

  // worn gear
  const gearLine = vm.gear && vm.gear.length ? `تجهیزات: ${vm.gear.join(' • ')}` : 'تجهیزات: لباس پیش‌فرض';
  D.drawText(ctx, gearLine, W / 2, 1262, { size: 26, color: theme.muted, maxWidth: 940, minSize: 14, shadow: null });

  return canvas;
}

module.exports = { drawCharacterCard, W, H };
