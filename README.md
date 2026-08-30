# ⚔️ Eris — Sword Path

A Telegram group PvP game bot inspired by *Mushoku Tensei*'s Eris Boreas Greyrat. Built with **Node.js** (Telegraf) and **PostgreSQL**.

Players duel each other with turn-based moves (Attack, Heavy Attack, Guard, Dodge, Counter), level up, climb a Sword Rank ladder, train stats, complete daily challenges, and collectively fill a group-wide "Eris Rage" meter that unleashes a boss-style event when it maxes out.

## Features

- **Turn-based PvP duels** — challenge via reply or `@username`, both players pick moves simultaneously each round, resolved with a full damage/crit/dodge/guard/counter engine.
- **Per-group progress** — the same Telegram account has completely independent Level/Rating/Rank in every group it plays in.
- **Sword Rank ladder** — derived from Level + Rating + duel count + win-rate (not just Level), from Beginner up to Sword God.
- **Training** — spend stamina to grind XP and a chance at permanent stat gains, on a cooldown.
- **Daily Challenges** — one random objective per day per player, with claimable rewards.
- **Eris Rage meter** — every duel, training session, and claimed daily challenge nudges a group-wide rage meter. At 100%, Eris challenges the whole group to a timed event where everyone gets one attack and the top damage dealers win big.
- **Leaderboards** — `/top` (per-group) and `/globaltop` (across all groups).
- **Admin tools** — `/give`, `/ban`, `/unban`, `/resetplayer`, `/startevent`, `/settings`.
- **Anti-abuse** — cooldowns on challenges/training, replay-proof callback handling, and reward decay for two players farming each other repeatedly.

## Requirements

- Node.js 18+
- PostgreSQL 13+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set BOT_TOKEN and DATABASE_URL (or the discrete PG* vars)

npm run migrate   # creates all tables
npm start         # launches the bot (long polling)
```

Add the bot to a Telegram **group** (not a channel or private chat — the game is group-only) and give it permission to read messages. Then run `/start` in the group.

## Project layout

```
src/
  config/         # env loading + all game-balance constants (edit constants.js to re-tune the game)
  database/       # pg pool, schema.sql, migration runner, and one model file per table
  utils/          # XP curve, ELO, Sword Rank derivation, formatting, anti-abuse helpers
  eris/           # Eris's dialogue lines (dialogues.json — editable without touching code) + rage service
  ranking/        # XP/level, rating (ELO), win-streak services
  economy/        # coin grant/spend helpers
  training/       # /train logic
  battle/         # the combat engine (pure functions) + battle manager (state machine, timers, payouts)
  events/         # Eris Rage Event (group boss-style event)
  services/       # cross-cutting glue (daily challenge progress hooks)
  bot/
    commands/     # one file per slash command
    actions/      # inline-button callback handlers
    middlewares/  # per-update context loading, callback replay guard, admin guard
    keyboards.js  # inline keyboard builders
    views/        # text renderers (profile card, etc.)
  index.js        # bootstrap: wires everything + cron sweeps for expired challenges/events
```

## Re-balancing the game

Every number that affects gameplay (damage multipliers, stamina costs, XP curve, coin rewards, rank thresholds, cooldown lengths, rage gains, etc.) lives in **`src/config/constants.js`**. Nothing else in the codebase hard-codes these values — change them there and restart the bot.

## Editing Eris's dialogue

Her lines live in **`src/eris/dialogues.json`**, grouped by moment (duel win/loss, rank up, rage thresholds, event start/end, etc.). Add or edit lines there; no code changes needed.

## Commands

See `/help` in-bot for the full, current list. Highlights: `/start`, `/profile`, `/fight`, `/train`, `/rank`, `/stats`, `/top`, `/globaltop`, `/daily`, `/rage`, `/event`.

## Notes on scaling

- Battle round timers currently live in-process (`Map`s in `battleManager.js`). If you ever run more than one bot instance, move these to a shared store (Redis) or make Postgres the source of truth for timeouts via a polling sweep — the DB-side state machine is already the source of truth for everything else, so this is a small extension, not a rewrite.
- All authoritative game state is in Postgres; the in-memory pieces are only for coordinating "did both players move yet" within one live round.
