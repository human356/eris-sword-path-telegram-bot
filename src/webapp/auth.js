'use strict';
const crypto = require('crypto');
const env = require('../config/env');

/**
 * Telegram Mini App authentication. The client sends `Telegram.WebApp.initData` in the
 * `X-Telegram-Init-Data` header; it is signed by Telegram with a key derived from the bot token:
 *   secret = HMAC_SHA256(key = "WebAppData", message = BOT_TOKEN)
 *   hash   = HMAC_SHA256(key = secret, message = sorted "key=value" lines without `hash`)
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
const MAX_AGE_SECONDS = 24 * 60 * 60;

function validateInitData(initData, botToken = env.BOT_TOKEN, now = Date.now()) {
  if (!initData || typeof initData !== 'string' || initData.length > 4096 || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > MAX_AGE_SECONDS) return null;
  try {
    const user = JSON.parse(params.get('user') || 'null');
    if (!user || !user.id) return null;
    return { user, authDate };
  } catch {
    return null;
  }
}

/** Express middleware: 401 unless a valid initData header is present; sets req.tgUser. */
function requireTelegramUser(req, res, next) {
  const data = validateInitData(req.get('x-telegram-init-data'));
  if (!data) return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  req.tgUser = data.user;
  return next();
}

module.exports = { validateInitData, requireTelegramUser };
