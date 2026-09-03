-- ==========================================================================
-- Phase 1 additions: Shop / Inventory / Card Loadout ("جیب من")
-- Append this block to the bottom of src/database/schema.sql, then run
-- `npm run migrate` again (all statements are IF NOT EXISTS-safe).
-- ==========================================================================

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
