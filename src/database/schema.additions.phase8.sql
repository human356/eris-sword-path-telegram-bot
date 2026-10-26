-- ==========================================================================
-- Phase 8 additions: /start gate, image-card profile + cache, admin-managed
-- images, paid profile templates / chosen titles, weekly shop offers and the
-- per-group "shop topic" auto-post settings.
-- Already appended to schema.sql (applied automatically on every boot);
-- kept here only as a readable changelog, like the earlier phase files.
-- ==========================================================================

-- /start gate: a player must have opened the bot in private at least once
-- (Telegram forbids bots from DM-ing users who never pressed Start, and the
-- shop purchase / "جیب من" flows live in the private chat).
ALTER TABLE users ADD COLUMN IF NOT EXISTS started_bot BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Every admin-configurable picture (profile templates, product photos, level-up
-- photos, shop banner). `slot_key` examples: tpl:DEFAULT, tpl:TPL_FLAME,
-- item:TREASURE_CHEST, level:5, level:default, shop:banner.
--   source = 'admin'  -> photo sent to the bot in private by a super admin
--   source = 'asset'  -> file shipped in /assets, uploaded to Telegram once;
--                        asset_sig is its content hash so a changed file is
--                        re-uploaded automatically after a deploy.
CREATE TABLE IF NOT EXISTS bot_images (
  slot_key         TEXT PRIMARY KEY,
  file_id          TEXT NOT NULL,
  file_unique_id   TEXT,
  source           TEXT NOT NULL DEFAULT 'admin',
  asset_sig        TEXT,
  updated_by       BIGINT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cache of the rendered profile picture: Telegram's file_id of the last card
-- we sent for this player+group and the hash of everything drawn on it. If the
-- hash is unchanged the card is re-sent by file_id (no rendering, no upload).
CREATE TABLE IF NOT EXISTS profile_card_cache (
  telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  card_hash     TEXT NOT NULL,
  file_id       TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, group_id)
);

-- A player's chosen paid profile template and displayed title (per group).
CREATE TABLE IF NOT EXISTS player_profile_prefs (
  telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  template_key  TEXT,
  title_key     TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, group_id)
);

-- Weekly discounts. One global row per week (same lazy-refresh pattern as
-- decorative_shop_rotation): items = [{ "key": "FIREBALL", "percent": 20 }, ...]
CREATE TABLE IF NOT EXISTS weekly_offers (
  id            BIGSERIAL PRIMARY KEY,
  items         JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weekly_offers_expires ON weekly_offers (expires_at DESC);

-- Where (which forum topic) and whether the bot auto-posts the weekly shop.
CREATE TABLE IF NOT EXISTS group_shop_settings (
  group_id        BIGINT PRIMARY KEY REFERENCES groups(group_id) ON DELETE CASCADE,
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  thread_id       BIGINT NOT NULL DEFAULT 0,
  last_post_key   TEXT,
  last_posted_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
