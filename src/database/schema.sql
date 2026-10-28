-- Eris — Sword Path
-- PostgreSQL schema
-- A "user" is global (one row per Telegram account). All in-game progress is
-- kept per-group in player_group_stats, because the same Telegram ID can have
-- completely independent Rank/Rating/Level in every group it plays in (spec §31).

CREATE TABLE IF NOT EXISTS users (
  telegram_id      BIGINT PRIMARY KEY,
  username         TEXT,
  display_name     TEXT NOT NULL,
  is_banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  group_id           BIGINT PRIMARY KEY,
  group_name         TEXT,
  eris_rage          NUMERIC NOT NULL DEFAULT 0,
  total_players      INTEGER NOT NULL DEFAULT 0,
  total_duels        INTEGER NOT NULL DEFAULT 0,
  total_xp           BIGINT NOT NULL DEFAULT 0,
  current_event_id   BIGINT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  group_id            BIGINT PRIMARY KEY REFERENCES groups(group_id) ON DELETE CASCADE,
  cooldowns_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  anti_abuse_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Per-group, per-player progress. This is the row the whole game actually plays against.
CREATE TABLE IF NOT EXISTS player_group_stats (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,

  level             INTEGER NOT NULL DEFAULT 1,
  xp                INTEGER NOT NULL DEFAULT 0,
  coins             INTEGER NOT NULL DEFAULT 100,

  hp                INTEGER NOT NULL DEFAULT 100,
  max_hp            INTEGER NOT NULL DEFAULT 100,
  stamina           INTEGER NOT NULL DEFAULT 100,
  max_stamina       INTEGER NOT NULL DEFAULT 100,

  attack            INTEGER NOT NULL DEFAULT 20,
  defense           INTEGER NOT NULL DEFAULT 15,
  speed             INTEGER NOT NULL DEFAULT 15,
  crit_chance       NUMERIC NOT NULL DEFAULT 0.10,

  wins              INTEGER NOT NULL DEFAULT 0,
  losses            INTEGER NOT NULL DEFAULT 0,
  draws             INTEGER NOT NULL DEFAULT 0,
  rating            INTEGER NOT NULL DEFAULT 1000,
  sword_rank        TEXT NOT NULL DEFAULT 'BEGINNER',

  eris_respect      INTEGER NOT NULL DEFAULT 0,
  total_fights      INTEGER NOT NULL DEFAULT 0,
  total_training    INTEGER NOT NULL DEFAULT 0,
  current_streak    INTEGER NOT NULL DEFAULT 0,
  best_streak       INTEGER NOT NULL DEFAULT 0,
  has_won_eris_challenge BOOLEAN NOT NULL DEFAULT FALSE,

  last_stamina_regen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hp_regen_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  join_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (telegram_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_pgs_group_rating ON player_group_stats (group_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_pgs_telegram ON player_group_stats (telegram_id);

-- Battle state machine: WAITING_FOR_ACCEPT -> ACTIVE -> WAITING_FOR_MOVES -> RESOLVING -> FINISHED
--                                                                                        -> CANCELLED / EXPIRED
CREATE TABLE IF NOT EXISTS battles (
  id                BIGSERIAL PRIMARY KEY,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  challenger_id     BIGINT NOT NULL REFERENCES users(telegram_id),
  opponent_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  state             TEXT NOT NULL DEFAULT 'WAITING_FOR_ACCEPT',
  round_number      INTEGER NOT NULL DEFAULT 0,

  challenger_hp     INTEGER NOT NULL,
  challenger_stamina INTEGER NOT NULL,
  opponent_hp       INTEGER NOT NULL,
  opponent_stamina  INTEGER NOT NULL,

  challenger_afk_streak INTEGER NOT NULL DEFAULT 0,
  opponent_afk_streak   INTEGER NOT NULL DEFAULT 0,

  chat_message_id   BIGINT, -- message being edited round-to-round
  winner_id         BIGINT REFERENCES users(telegram_id),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_battles_group_state ON battles (group_id, state);

CREATE TABLE IF NOT EXISTS battle_rounds (
  id                BIGSERIAL PRIMARY KEY,
  battle_id         BIGINT NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  round_number      INTEGER NOT NULL,
  challenger_move   TEXT,
  opponent_move     TEXT,
  challenger_damage_dealt INTEGER NOT NULL DEFAULT 0,
  opponent_damage_dealt   INTEGER NOT NULL DEFAULT 0,
  log               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (battle_id, round_number)
);

CREATE TABLE IF NOT EXISTS transactions (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  group_id          BIGINT NOT NULL REFERENCES groups(group_id),
  type              TEXT NOT NULL, -- PVP_WIN, PVP_LOSS, TRAINING, DAILY, ERIS_EVENT, ADMIN_GIVE, ...
  coins_delta       INTEGER NOT NULL DEFAULT 0,
  xp_delta          INTEGER NOT NULL DEFAULT 0,
  rating_delta      INTEGER NOT NULL DEFAULT 0,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_lookup ON transactions (telegram_id, group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS training_logs (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  group_id          BIGINT NOT NULL REFERENCES groups(group_id),
  training_type     TEXT NOT NULL,
  stat_gained       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_challenges (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  group_id          BIGINT NOT NULL REFERENCES groups(group_id),
  challenge_key     TEXT NOT NULL, -- e.g. WIN_3_DUELS, BEAT_HIGHER_RATED
  target            INTEGER NOT NULL DEFAULT 1,
  progress          INTEGER NOT NULL DEFAULT 0,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  claimed           BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_id, group_id, assigned_date)
);

CREATE TABLE IF NOT EXISTS achievements (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  group_id          BIGINT NOT NULL REFERENCES groups(group_id),
  achievement_key   TEXT NOT NULL, -- FIRST_BLOOD, UNSTOPPABLE, SWORD_SAINT, ERIS_FAVORITE, UNDERDOG, RAGE_SURVIVOR
  unlocked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (telegram_id, group_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS events (
  id                BIGSERIAL PRIMARY KEY,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  type              TEXT NOT NULL DEFAULT 'ERIS_CHALLENGE',
  state             TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, FINISHED, CANCELLED
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at           TIMESTAMPTZ NOT NULL,
  chat_message_id   BIGINT,
  results           JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS event_participants (
  id                BIGSERIAL PRIMARY KEY,
  event_id          BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id),
  damage            INTEGER NOT NULL DEFAULT 0,
  attempted         BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (event_id, telegram_id)
);

CREATE TABLE IF NOT EXISTS eris_rage (
  group_id          BIGINT PRIMARY KEY REFERENCES groups(group_id) ON DELETE CASCADE,
  rage              NUMERIC NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generic cooldown ledger: one row per (telegram_id, group_id, action).
CREATE TABLE IF NOT EXISTS cooldowns (
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  action            TEXT NOT NULL,
  available_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (telegram_id, group_id, action)
);

-- Materialized/denormalized leaderboard snapshot (optional cache; the live
-- leaderboard is always computed from player_group_stats, this table is used
-- for season history / global leaderboard aggregation).
CREATE TABLE IF NOT EXISTS leaderboards (
  id                BIGSERIAL PRIMARY KEY,
  scope             TEXT NOT NULL, -- 'GROUP' or 'GLOBAL'
  group_id          BIGINT REFERENCES groups(group_id) ON DELETE CASCADE,
  season            INTEGER NOT NULL DEFAULT 1,
  snapshot          JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency guard for Telegram callback queries (spec §25: no replayed callbacks).
CREATE TABLE IF NOT EXISTS processed_callbacks (
  callback_id       TEXT PRIMARY KEY,
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Phase 1

-- One row per (player, group, item). Item definitions themselves live in
-- src/config/items.json, not in the DB — this table only tracks quantities.
CREATE TABLE IF NOT EXISTS inventory_items (
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  item_key          TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, group_id, item_key)
);

-- A player's 5 active battle-card slots ("جیب من" loadout). Starts out
-- pre-filled with the 5 starter moves (ATTACK/GUARD/DODGE/HEAVY_ATTACK/COUNTER)
-- the first time it's read — see cardLoadoutModel.getLoadout().
CREATE TABLE IF NOT EXISTS player_loadout (
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  slot              INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  card_key          TEXT NOT NULL,
  PRIMARY KEY (telegram_id, group_id, slot)
);

-- Ledger of shop purchases, used to enforce each item's dailyLimit from items.json.
CREATE TABLE IF NOT EXISTS shop_purchase_log (
  id                BIGSERIAL PRIMARY KEY,
  telegram_id       BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  item_key          TEXT NOT NULL,
  quantity          INTEGER NOT NULL,
  purchased_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_purchase_lookup
  ON shop_purchase_log (telegram_id, group_id, item_key, purchased_date);

-- Phase 4
ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_locked_move TEXT;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_locked_move TEXT;

-- Rolling list of in-progress timed effects: poison DOT (باتلاق سمی), the
-- stamina-regen buff (عروسک گربه‌ای), one-round stun (رعد و برق / پری موفق),
-- and one-round guard-break (دیوارشکن). Each entry looks like:
--   { "side": "CHALLENGER" | "OPPONENT", "type": "POISON" | "STAMINA_REGEN_BUFF" | "STUN" | "GUARD_BREAK",
--     "roundsRemaining": 3, "amountPerRound": 15 }
-- Processed and decremented at the start of every round in battleManager.
ALTER TABLE battles ADD COLUMN IF NOT EXISTS active_effects JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Set by طومار پنهان کردن حقیقت: 'CHALLENGER' or 'OPPONENT' — that side's
-- true HP is shown as "❓" instead of a number in the NEXT round report.
ALTER TABLE battles ADD COLUMN IF NOT EXISTS hidden_report_side TEXT;

-- Phase 5
CREATE TABLE IF NOT EXISTS multiplayer_battles (
  id                BIGSERIAL PRIMARY KEY,
  group_id          BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  type              TEXT NOT NULL, -- 'TEAM' | 'FFA' | 'PVE'
  state             TEXT NOT NULL DEFAULT 'RECRUITING',
  -- RECRUITING -> ACTIVE (players joining) -> WAITING_FOR_MOVES -> RESOLVING -> FINISHED / CANCELLED / EXPIRED
  round_number      INTEGER NOT NULL DEFAULT 0,
  max_rounds        INTEGER NOT NULL,
  difficulty        TEXT, -- PVE only: 'EASY' | 'MEDIUM' | 'HARD'
  initiator_id      BIGINT NOT NULL REFERENCES users(telegram_id),
  chat_message_id   BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  recruit_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mpb_group_state ON multiplayer_battles (group_id, state);

-- One row per fighter, human or AI. `telegram_id` is NULL for the AI combatant
-- in a PVE battle (identified by is_bot = TRUE instead).
CREATE TABLE IF NOT EXISTS battle_participants (
  id                BIGSERIAL PRIMARY KEY,
  battle_id         BIGINT NOT NULL REFERENCES multiplayer_battles(id) ON DELETE CASCADE,
  telegram_id       BIGINT REFERENCES users(telegram_id),
  is_bot            BOOLEAN NOT NULL DEFAULT FALSE,
  display_name      TEXT NOT NULL,
  team              TEXT, -- 'A' | 'B' for TEAM battles, NULL otherwise
  hp                INTEGER NOT NULL,
  max_hp            INTEGER NOT NULL,
  stamina           INTEGER NOT NULL,
  max_stamina       INTEGER NOT NULL,
  afk_streak        INTEGER NOT NULL DEFAULT 0,
  locked_move       TEXT,
  is_eliminated     BOOLEAN NOT NULL DEFAULT FALSE,
  active_effects    JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bp_battle ON battle_participants (battle_id);

-- Phase 6

-- One global active row describing which DECORATIVE items.json keys the
-- shop currently shows. Refreshed lazily (see decorativeRotationModel.js)
-- whenever it's read and the previous row has expired — no cron needed.
-- Global across all groups (confirmed: سراسری چرخش, not per-group).
CREATE TABLE IF NOT EXISTS decorative_shop_rotation (
  id            BIGSERIAL PRIMARY KEY,
  item_keys     JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decorative_rotation_expires ON decorative_shop_rotation (expires_at DESC);

-- A player's chosen decorative items shown on their /profile card, per group.
-- Same shape as player_loadout: one row per filled slot,
-- slot 1..PLAYER_SHOWCASE_SLOTS (3).
CREATE TABLE IF NOT EXISTS player_showcase (
  telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  slot          INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  item_key      TEXT NOT NULL,
  PRIMARY KEY (telegram_id, group_id, slot)
);

-- Phase 7: Telegram forum topics
-- Which topics (threads) a bot section is limited to. A feature with NO rows
-- works everywhere. thread_id 0 = "General" topic / groups without topics.
CREATE TABLE IF NOT EXISTS group_topic_rules (
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  feature_key   TEXT NOT NULL,
  thread_id     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, feature_key, thread_id)
);

-- Topic names learned from service messages, only used to make the admin panel readable.
CREATE TABLE IF NOT EXISTS group_topics (
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  thread_id     BIGINT NOT NULL,
  name          TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, thread_id)
);

-- Battles/events remember their topic so timer-driven messages land in the same place.
ALTER TABLE battles ADD COLUMN IF NOT EXISTS thread_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE multiplayer_battles ADD COLUMN IF NOT EXISTS thread_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS thread_id BIGINT NOT NULL DEFAULT 0;

-- Phase 8
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

-- Semi-pixel character (per player per group, like inventory/coins). `appearance` = gender, face,
-- ears, eyes, mouth, nose, eyebrow/hair/mustache types + colours; `outfit` = worn gear per slot.
-- The «شخصیت» section is unlocked by owning the CHARACTER_DOLL shop item in that group.
CREATE TABLE IF NOT EXISTS player_character (
  telegram_id  BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id     BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  appearance   JSONB NOT NULL DEFAULT '{}'::jsonb,
  outfit       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (telegram_id, group_id)
);
