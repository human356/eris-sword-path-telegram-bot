-- ==========================================================================
-- Phase 4 additions: special battle cards + timed battle effects
-- Append this block to schema.sql, then run `npm run migrate` again.
-- ==========================================================================

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
