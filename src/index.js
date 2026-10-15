'use strict';
const { Telegraf } = require('telegraf');
const express = require('express');
const cron = require('node-cron');
const env = require('./config/env');

const ensureContext = require('./bot/middlewares/ensureContext');
const callbackGuard = require('./bot/middlewares/callbackGuard');
const autoDeleteMiddleware = require('./bot/middlewares/autoDeleteMiddleware');
const topicGuard = require('./bot/middlewares/topicGuard');
const { runMigration } = require('./database/migrate');

const { createBattleManager } = require('./battle/battleManager');
const erisEventService = require('./events/erisEventService');
const inventoryCommand = require('./bot/commands/inventory');
const { createMultiplayerBattleManager } = require('./battle/multiplayerBattleManager');


if (!env.BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] BOT_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const bot = new Telegraf(env.BOT_TOKEN);
const battleManager = createBattleManager(bot);

bot.use(callbackGuard);
bot.use(ensureContext);
// Phase 6: patches ctx.reply to auto-delete inside groups by default (chat
// cleanup) and adds ctx.replyPersist for the 3 exempt message categories.
// Must come after ensureContext, which sets ctx.state.isGroup.
bot.use(autoDeleteMiddleware);
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
const server = app.listen(PORT, () => {
  console.log(`🌐 Health server running on port ${PORT}`);
});
// ============================================================
// START / DEEP LINKS
// ============================================================

bot.start(async (ctx, next) => {
  if (ctx.state && ctx.state.isGroup) return next();
  const payload =
    ctx.message?.text?.split(' ').slice(1).join(' ') || '';

  // Deep Link مخصوص «جیب من»
  if (payload.startsWith('jib_')) {
    const handled = await inventoryCommand.handleInventoryStart(
      ctx,
      payload
    );

    if (handled) return;
  }

  // ==========================================================
  // START عادی ربات
  // ==========================================================

  // اگر /start عادی فعلی رباتت کدی دارد،
  // آن کد را اینجا قرار بده.

  await ctx.reply(
    '⚔️ به Eris — Sword Path خوش آمدید!'
  );
});
// Commands
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
// Apply schema.sql first (idempotent), then start polling.
runMigration()
  .then(() => bot.launch(
    { allowedUpdates: ['message', 'callback_query'] },
    () => console.log('[bootstrap] Eris — Sword Path is online.')
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
