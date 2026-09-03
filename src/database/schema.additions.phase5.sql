-- ==========================================================================
-- Phase 5 additions: team battles / PvE training battles / free-for-all
-- Append this block to schema.sql, then run `npm run migrate` again.
--
-- Deliberately a SEPARATE model from `battles`/`battle_rounds` (the 2-player
-- duel system from Phases 1-4, which stays completely untouched). Those
-- tables hard-code exactly two sides (challenger/opponent columns); these
-- new modes need anywhere from 2 to ~8 simultaneous participants, so a
-- proper one-row-per-participant table is the only sane way to model it.
-- ==========================================================================

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
