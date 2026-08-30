'use strict';
const rageModel = require('../../database/models/rageModel');
const rageService = require('../../eris/rageService');
const erisVoice = require('../../eris/erisVoice');
const { progressBar } = require('../../utils/format');

async function showRage(ctx) {
  const { groupId } = ctx.state;
  const rage = await rageModel.getRage(groupId);
  const level = rageService.getRageLevel(rage);

  let text = `🔥 <b>ERIS RAGE</b>\n\n${progressBar(rage, 100)} ${Math.round(rage)}%\n\n${level.label}`;

  if (rage >= 100) {
    text += `\n\n${erisVoice.say('rage_100')}\n\nUse /event to see the current Eris Challenge.`;
  } else if (rage >= 80) {
    text += `\n\nEris: "${erisVoice.say('rage_80')}"`;
  } else if (rage >= 60) {
    text += `\n\nEris: "${erisVoice.say('rage_60')}"`;
  } else {
    text += `\n\nEris is getting angry...`;
  }

  await ctx.reply(text, { parse_mode: 'HTML' });
}

function register(bot) {
  bot.command('rage', async (ctx) => { if (ctx.state.isGroup) await showRage(ctx); });
  bot.action('menu:rage', async (ctx) => { await ctx.answerCbQuery(); await showRage(ctx); });
}

module.exports = { register };
