-- ==========================================================================
-- Phase 6 additions: decorative items / weekly shop rotation / profile
-- showcase / treasure chest.
-- Append this block to the bottom of src/database/schema.sql, then run
-- `npm run migrate` again (all statements are IF NOT EXISTS-safe).
--
-- Treasure chests themselves need NO new table — they're just another
-- items.json entry ("TREASURE_CHEST", category MYSTERY) tracked through the
-- existing inventory_items table, opened via treasureChestService.js.
-- ==========================================================================

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

-- A player's chosen decorative items shown on their /profile card, per group
-- (profile itself is per-group, same pattern as player_group_stats — spec
-- §31). Same shape as player_loadout: one row per filled slot,
-- slot 1..PLAYER_SHOWCASE_SLOTS (3).
CREATE TABLE IF NOT EXISTS player_showcase (
  telegram_id   BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  group_id      BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  slot          INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 3),
  item_key      TEXT NOT NULL,
  PRIMARY KEY (telegram_id, group_id, slot)
);
