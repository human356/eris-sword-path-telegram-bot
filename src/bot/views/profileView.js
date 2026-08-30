'use strict';
const { xpRequiredForLevel, winRate } = require('../../utils/formulas');
const { getRankByKey } = require('../../utils/rankUtil');
const { num, escapeHtml } = require('../../utils/format');

function renderProfile(displayName, stats) {
  const rank = getRankByKey(stats.sword_rank);
  const requiredXp = xpRequiredForLevel(stats.level);
  const wr = Math.round(winRate(stats.wins, stats.losses) * 100);
  const critPct = Math.round(Number(stats.crit_chance) * 100);

  return (
    `⚔️ <b>SWORD PROFILE</b>\n\n` +
    `👤 ${escapeHtml(displayName)}\n\n` +
    `🏆 Sword Rank:\n${rank ? rank.label : stats.sword_rank}\n\n` +
    `⭐ Level:\n${stats.level}\n\n` +
    `✨ XP:\n${num(stats.xp)} / ${num(requiredXp)}\n\n` +
    `🪙 Coins:\n${num(stats.coins)}\n\n` +
    `❤️ HP:\n${stats.hp} / ${stats.max_hp}\n\n` +
    `⚡ Stamina:\n${stats.stamina} / ${stats.max_stamina}\n\n` +
    `⚔️ Attack:\n${stats.attack}\n\n` +
    `🛡 Defense:\n${stats.defense}\n\n` +
    `💨 Speed:\n${stats.speed}\n\n` +
    `🎯 Critical:\n${critPct}%\n\n` +
    `🏆 Rating:\n${num(stats.rating)}\n\n` +
    `⚔️ Wins:\n${num(stats.wins)}\n\n` +
    `💀 Losses:\n${num(stats.losses)}\n\n` +
    `📊 Win Rate:\n${wr}%\n\n` +
    `🔥 Win Streak:\n${stats.current_streak}\n\n` +
    `❤️ Eris Respect:\n${num(stats.eris_respect)}`
  );
}

function renderWelcome(displayName, stats) {
  return (
    `⚔️ <b>WELCOME TO THE SWORD PATH</b>\n\n` +
    `Eris:\n"اگر می‌خوای قوی بشی، اول باید ثابت کنی لیاقتش رو داری."\n\n` +
    `👤 Player:\n${escapeHtml(displayName)}\n\n` +
    `⚔️ Rank:\nBeginner\n\n` +
    `⭐ Level:\n${stats.level}\n\n` +
    `✨ XP:\n${stats.xp} / ${xpRequiredForLevel(stats.level)}\n\n` +
    `❤️ HP:\n${stats.hp}\n\n` +
    `⚡ Stamina:\n${stats.stamina}\n\n` +
    `🪙 Coins:\n${stats.coins}\n\n` +
    `🔥 Eris Respect:\n${stats.eris_respect}`
  );
}

module.exports = { renderProfile, renderWelcome };
