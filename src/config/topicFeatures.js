'use strict';

/**
 * Bot sections an admin can pin to specific Telegram topics (forum threads).
 * A section with NO rules works everywhere (default, fully optional).
 */
const FEATURES = {
  PANEL: { label: '🗡 پنل اریس (نوشتن «اریس»)' },
  DUEL: { label: '⚔️ دوئل (/fight)' },
  BATTLES: { label: '🤺 نبرد تمرینی / تیمی / آزاد' },
  TRAINING: { label: '🏋️ تمرین' },
  PROFILE: { label: '👤 پروفایل، رتبه و آمار' },
  LEADERBOARD: { label: '🏆 جدول رتبه‌بندی' },
  DAILY: { label: '🎯 چالش روزانه' },
  RAGE_EVENT: { label: '🔥 خشم اریس و رویداد' },
  SHOP: { label: '🛒 فروشگاه' },
  INVENTORY: { label: '🎒 جیب من' },
};

const FEATURE_KEYS = Object.keys(FEATURES);

const COMMAND_MAP = {
  start: 'PROFILE', profile: 'PROFILE', character: 'PROFILE', shakhsiat: 'PROFILE', panel: 'PROFILE', rank: 'PROFILE', stats: 'PROFILE',
  fight: 'DUEL',
  trainbattle: 'BATTLES', pve: 'BATTLES', teambattle: 'BATTLES', freeforall: 'BATTLES', ffa: 'BATTLES',
  train: 'TRAINING',
  top: 'LEADERBOARD', globaltop: 'LEADERBOARD',
  daily: 'DAILY',
  rage: 'RAGE_EVENT', event: 'RAGE_EVENT',
  shop: 'SHOP',
  inventory: 'INVENTORY', jibeman: 'INVENTORY',
};

const HEARS_MAP = {
  'اریس': 'PANEL',
  'پنل اریس': 'PANEL',
  'پروفایل اریس': 'PROFILE',
  'شخصیت': 'PROFILE',
};

// Order matters: first matching prefix wins.
// NOTE: `battle:` and `mp:` (buttons of battles that are ALREADY running) are
// deliberately not listed, so changing the rules mid-fight never traps players.
const CALLBACK_PREFIXES = [
  ['menu:fight', 'DUEL'],
  ['menu:training', 'TRAINING'],
  ['training:', 'TRAINING'],
  ['menu:profile', 'PROFILE'],
  ['menu:character', 'PROFILE'],
  ['view:', 'PROFILE'],
  ['menu:ranking', 'LEADERBOARD'],
  ['menu:daily', 'DAILY'],
  ['daily:', 'DAILY'],
  ['menu:rage', 'RAGE_EVENT'],
  ['event:', 'RAGE_EVENT'],
  ['menu:shop', 'SHOP'],
  ['shop:', 'SHOP'],
  ['menu:inventory', 'INVENTORY'],
  ['pve:', 'BATTLES'],
  ['eris:', 'BATTLES'],
];

/** Returns the feature key an incoming update belongs to, or null if unrestricted. */
function detectFeature(ctx) {
  if (ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string') {
    const data = ctx.callbackQuery.data;
    for (const [prefix, feature] of CALLBACK_PREFIXES) {
      if (data.startsWith(prefix)) return feature;
    }
    return null;
  }

  const text = ctx.message && typeof ctx.message.text === 'string' ? ctx.message.text : null;
  if (!text) return null;

  const cmd = text.match(/^\/([A-Za-z0-9_]+)(?:@([A-Za-z0-9_]+))?(?:\s|$)/);
  if (cmd) {
    const botName = ctx.botInfo && ctx.botInfo.username;
    if (cmd[2] && botName && cmd[2].toLowerCase() !== botName.toLowerCase()) return null;
    return COMMAND_MAP[cmd[1].toLowerCase()] || null;
  }

  return HEARS_MAP[text.trim()] || null;
}

module.exports = { FEATURES, FEATURE_KEYS, detectFeature };
