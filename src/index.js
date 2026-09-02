'use strict';
const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const env = require('./config/env');

const ensureContext = require('./bot/middlewares/ensureContext');
const callbackGuard = require('./bot/middlewares/callbackGuard');

const { createBattleManager } = require('./battle/battleManager');
const erisEventService = require('./events/erisEventService');

if (!env.BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] BOT_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Telegraf(env.BOT_TOKEN);
const battleManager = createBattleManager(bot);

bot.use(callbackGuard);
bot.use(ensureContext);
const app = express();
const PORT = 3000;

// صفحه اصلی
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'telegram-bot',
    message: 'ErisBot server is running'
  });
});
const server = app.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});

// Commands
require('./bot/commands/profile').register(bot);
require('./bot/commands/fight').register(bot, battleManager);
require('./bot/commands/train').register(bot);
require('./bot/commands/leaderboard').register(bot);
require('./bot/commands/rankStats').register(bot);
require('./bot/commands/daily').register(bot);
require('./bot/commands/rage').register(bot);
require('./bot/commands/event').register(bot);
require('./bot/commands/shop').register(bot);
require('./bot/commands/inventory').register(bot);
require('./bot/commands/help').register(bot);
require('./bot/commands/admin').register(bot);

// Actions
require('./bot/actions/battleActions').register(bot, battleManager);

bot.catch((err, ctx) => {
  // eslint-disable-next-line no-console
  console.error(`[bot] error while handling update ${ctx.updateType}:`, err);
});

// Sweep expired challenges (nobody accepted in time) every 15s.
cron.schedule('*/15 * * * * *', () => {
  battleManager.sweepExpiredChallenges().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[cron] sweepExpiredChallenges failed:', err);
  });
});

// Sweep expired Eris events every 30s.
cron.schedule('*/30 * * * * *', () => {
  erisEventService.sweepExpiredEvents(bot).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[cron] sweepExpiredEvents failed:', err);
  });
});

bot.launch().then(() => {
  // eslint-disable-next-line no-console
  console.log('[bootstrap] Eris — Sword Path is online.');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));