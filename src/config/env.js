'use strict';
require('dotenv').config();

function parseAdminIds(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
  PGHOST: process.env.PGHOST,
  PGPORT: process.env.PGPORT,
  PGUSER: process.env.PGUSER,
  PGPASSWORD: process.env.PGPASSWORD,
  PGDATABASE: process.env.PGDATABASE,
  SUPER_ADMIN_IDS: parseAdminIds(process.env.SUPER_ADMIN_IDS),
  // Optional: only used as a fallback when Telegram's getMe hasn't filled ctx.botInfo yet.
  BOT_USERNAME: (process.env.BOT_USERNAME || '').replace(/^@/, ''),
  // Public HTTPS base URL of this server (e.g. https://eris.example.com) — hosts the Mini App and shop thumbnails.
  WEBAPP_URL: (process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, ''),
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
