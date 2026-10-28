'use strict';
const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const env = require('./config/env');
const C = require('./config/constants');
const { runRegenTick } = require('./regen/regenService');

const ensureContext = require('./bot/middlewares/ensureContext');
const callbackGuard = require('./bot/middlewares/callbackGuard');
const autoDeleteMiddleware = require('./bot/middlewares/autoDeleteMiddleware');
const topicGuard = require('./bot/middlewares/topicGuard');
const { runMigration } = require('./database/migrate');

const { createBattleManager } = require('./battle/battleManager');
const erisEventService = require('./events/erisEventService');
const imageService = require('./services/imageService');
const shopPostService = require('./services/shopPostService');
const startGate = require('./bot/middlewares/startGate');
const { createMultiplayerBattleManager } = require('./battle/multiplayerBattleManager');


if (!env.BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] BOT_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Telegraf(env.BOT_TOKEN);
const battleManager = createBattleManager(bot);
imageService.init(bot.telegram);

bot.use(callbackGuard);
bot.use(ensureContext);
// Phase 6: patches ctx.reply to auto-delete inside groups by default (chat
// cleanup) and adds ctx.replyPersist for the 3 exempt message categories.
// Must come after ensureContext, which sets ctx.state.isGroup.
bot.use(autoDeleteMiddleware);
// /start gate: group players must have pressed Start in private once.
bot.use(startGate);
// Topics: blocks sections an admin pinned to other forum topics (optional feature).
bot.use(topicGuard);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// صفحه اصلی
app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'telegram-bot',
    message: 'ErisBot server is running'
  });
});
// Character Mini App (EJS pages + Telegram-authenticated API). A missing `ejs` package must not take the bot down.
try {
  require('./webapp/router').mount(app);
} catch (err) {
  console.error('[webapp] Mini App disabled:', err.message, '— run `npm install` (needs the "ejs" package).');
}
const server = app.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});
// Commands
require('./bot/commands/start').register(bot);
require('./bot/commands/adminImages').register(bot);
const multiplayerBattleManager = createMultiplayerBattleManager(bot);
require('./bot/commands/erisTrigger').register(bot, multiplayerBattleManager);
require('./bot/commands/profile').register(bot);
require('./bot/commands/fight').register(bot, battleManager);
require('./bot/commands/multiplayerCommands').register(bot, multiplayerBattleManager);
require('./bot/commands/train').register(bot);
require('./bot/commands/leaderboard').register(bot);
require('./bot/commands/rankStats').register(bot);
require('./bot/commands/daily').register(bot);
require('./bot/commands/rage').register(bot);
require('./bot/commands/event').register(bot);
require('./bot/commands/shop').register(bot);
require('./bot/commands/inventory').register(bot);
require('./bot/commands/profileManage').register(bot);
require('./bot/commands/privateShop').register(bot);
require('./bot/commands/character').register(bot);
require('./bot/commands/inlineShop').register(bot);
require('./bot/commands/shopTopic').register(bot);
require('./bot/commands/help').register(bot);
require('./bot/commands/admin').register(bot);
require('./bot/commands/topics').register(bot);

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
 // Sweep multiplayer lobbies that never got enough players, every 15s.
    cron.schedule('*/15 * * * * *', () => {
    multiplayerBattleManager.sweepExpiredRecruiting().catch((err) => {
    console.error('[cron] sweepExpiredRecruiting failed:', err);
  });
});

// Sweep expired Eris events every 30s.
cron.schedule('*/30 * * * * *', () => {
  erisEventService.sweepExpiredEvents(bot).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[cron] sweepExpiredEvents failed:', err);
  });
});
// Passive regen for all players: +1% stamina/HP every REGEN_TICK_MINUTES minutes.
cron.schedule(`*/${C.REGEN_TICK_MINUTES} * * * *`, () => {
  runRegenTick().catch((err) => {
    console.error('[cron] runRegenTick failed:', err);
  });
});

// Weekly shop auto-post into the topic admins chose with /shoptopic.
cron.schedule(C.SHOP_POST_SWEEP_CRON, () => {
  shopPostService.sweep(bot.telegram).catch((err) => {
    console.error('[cron] shop post sweep failed:', err);
  });
});

// Apply schema.sql first (idempotent), then start polling.
runMigration()
  .then(() => bot.launch(
    { allowedUpdates: ['message', 'callback_query', 'inline_query'] },
    () => {
      console.log('[bootstrap] Eris — Sword Path is online.');
      // Upload the pictures shipped in /assets once (inline shop needs Telegram file_ids).
      imageService.primeAssets()
        .then((r) => console.log(`[images] assets primed: ${r.uploaded} uploaded, ${r.skipped} already up to date`))
        .catch((err) => console.error('[images] primeAssets failed:', err.message));
    }
  ))
  .catch((err) => {
    console.error('[bootstrap] failed to start:', err);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));


const shutdown = (signal) => {
  bot.stop(signal);
  server.close();
};
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
