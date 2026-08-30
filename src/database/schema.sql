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
